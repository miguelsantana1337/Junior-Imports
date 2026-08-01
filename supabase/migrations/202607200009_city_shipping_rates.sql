-- Tarifas de entrega por cidade, com cotação manual para localidades não
-- cadastradas. O cálculo é repetido no banco para que o valor enviado pelo
-- navegador nunca seja a fonte de verdade do pedido.

alter table public.store_settings
  add column if not exists shipping_city_rates jsonb not null default '[]'::jsonb,
  add column if not exists quote_shipping_outside_cities boolean not null default false;

alter table public.store_settings
  drop constraint if exists store_settings_shipping_city_rates_array;
alter table public.store_settings
  add constraint store_settings_shipping_city_rates_array
  check (jsonb_typeof(shipping_city_rates) = 'array');

alter table public.orders
  add column if not exists shipping_status text not null default 'calculated';

alter table public.orders
  drop constraint if exists orders_shipping_status_check;
alter table public.orders
  add constraint orders_shipping_status_check
  check (shipping_status in ('free', 'calculated', 'quote', 'pending'));

update public.orders
set shipping_status = case when shipping > 0 then 'calculated' else 'free' end;

create or replace function public.normalize_shipping_city(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    translate(
      lower(trim(coalesce(p_value, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  );
$$;

create or replace function public.calculate_storefront_shipping(
  p_tenant_id uuid,
  p_customer jsonb,
  p_after_discounts numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.store_settings%rowtype;
  v_city text := public.normalize_shipping_city(p_customer->>'city');
  v_state text := upper(trim(coalesce(p_customer->>'state', '')));
  v_rate jsonb;
  v_rate_city text;
  v_rate_state text;
  v_rate_amount numeric(12,2);
begin
  select * into v_settings
  from public.store_settings
  where tenant_id = p_tenant_id and id = 'default';

  if not found then
    raise exception 'Configuração da loja não encontrada';
  end if;

  if v_settings.free_shipping_enabled
    and p_after_discounts >= v_settings.free_shipping_threshold
  then
    return jsonb_build_object('amount', 0, 'status', 'free');
  end if;

  if jsonb_array_length(coalesce(v_settings.shipping_city_rates, '[]'::jsonb)) > 0
    and v_city = ''
  then
    return jsonb_build_object('amount', 0, 'status', 'pending');
  end if;

  for v_rate in
    select value
    from jsonb_array_elements(coalesce(v_settings.shipping_city_rates, '[]'::jsonb))
  loop
    v_rate_city := public.normalize_shipping_city(v_rate->>'city');
    v_rate_state := upper(trim(coalesce(v_rate->>'state', '')));
    if v_rate_city = v_city and (v_rate_state = '' or v_rate_state = v_state) then
      begin
        v_rate_amount := greatest(0, coalesce((v_rate->>'amount')::numeric, 0));
      exception when invalid_text_representation then
        v_rate_amount := 0;
      end;
      return jsonb_build_object('amount', v_rate_amount, 'status', 'calculated');
    end if;
  end loop;

  if jsonb_array_length(coalesce(v_settings.shipping_city_rates, '[]'::jsonb)) > 0
    and v_settings.quote_shipping_outside_cities
  then
    return jsonb_build_object('amount', 0, 'status', 'quote');
  end if;

  return jsonb_build_object(
    'amount', greatest(0, coalesce(v_settings.shipping_flat, 0)),
    'status', 'calculated'
  );
end;
$$;

do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.create_tenant_order_secure(uuid,jsonb,jsonb,text,text,uuid,text,text,text,integer)'::regprocedure
  ) into current_definition;

  updated_definition := replace(
    current_definition,
    'v_shipping numeric(12,2) := 0;',
    'v_shipping numeric(12,2) := 0;' || chr(10) ||
    '  v_shipping_status text := ''calculated'';' || chr(10) ||
    '  v_shipping_quote jsonb;'
  );

  updated_definition := replace(
    updated_definition,
    'if not v_settings.free_shipping_enabled or v_total < v_settings.free_shipping_threshold then' || chr(10) ||
    '    v_shipping := v_settings.shipping_flat;' || chr(10) ||
    '  end if;' || chr(10) ||
    '  v_total := v_total + v_shipping;',
    'v_shipping_quote := public.calculate_storefront_shipping(p_tenant_id, p_customer, v_total);' || chr(10) ||
    '  v_shipping := coalesce((v_shipping_quote->>''amount'')::numeric, 0);' || chr(10) ||
    '  v_shipping_status := coalesce(v_shipping_quote->>''status'', ''calculated'');' || chr(10) ||
    '  v_total := v_total + v_shipping;'
  );

  updated_definition := replace(
    updated_definition,
    'coupon_code, reservation_expires_at, order_source)',
    'coupon_code, reservation_expires_at, order_source, shipping_status)'
  );

  updated_definition := replace(
    updated_definition,
    'case when v_coupon.id is null then '''' else v_coupon.code end, v_expires_at, p_source);',
    'case when v_coupon.id is null then '''' else v_coupon.code end, v_expires_at, p_source, v_shipping_status);'
  );

  updated_definition := replace(
    updated_definition,
    '''shipping'', v_shipping,',
    '''shipping'', v_shipping,' || chr(10) ||
    '    ''shipping_status'', v_shipping_status,'
  );

  if updated_definition = current_definition
    or position('calculate_storefront_shipping' in updated_definition) = 0
    or position('shipping_status' in updated_definition) = 0
  then
    raise exception 'Não foi possível atualizar o cálculo seguro de frete';
  end if;

  execute updated_definition;
end;
$$;

update public.store_settings
set shipping_city_rates = jsonb_build_array(
      jsonb_build_object('city', 'Ipatinga', 'state', 'MG', 'amount', 10),
      jsonb_build_object('city', 'Coronel Fabriciano', 'state', 'MG', 'amount', 20),
      jsonb_build_object('city', 'Timóteo', 'state', 'MG', 'amount', 30)
    ),
    quote_shipping_outside_cities = true,
    shipping_flat = 10
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id = 'default';

revoke all on function public.normalize_shipping_city(text) from public;
revoke all on function public.calculate_storefront_shipping(uuid, jsonb, numeric) from public;
grant execute on function public.normalize_shipping_city(text) to service_role;
grant execute on function public.calculate_storefront_shipping(uuid, jsonb, numeric) to service_role;
