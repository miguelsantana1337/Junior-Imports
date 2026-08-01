begin;

-- A retirada é configurável por loja. O endereço exato pode permanecer fora
-- da vitrine e ser confirmado pelo atendimento no WhatsApp.
alter table public.store_settings
  add column if not exists local_pickup_enabled boolean not null default false,
  add column if not exists local_pickup_instructions text not null
    default 'O endereço e o horário de retirada serão confirmados pelo WhatsApp.';

alter table public.store_settings
  drop constraint if exists store_settings_local_pickup_instructions_length;
alter table public.store_settings
  add constraint store_settings_local_pickup_instructions_length
  check (char_length(trim(local_pickup_instructions)) between 3 and 300);

alter table public.orders
  drop constraint if exists orders_shipping_status_check;
alter table public.orders
  add constraint orders_shipping_status_check
  check (shipping_status in ('free', 'calculated', 'quote', 'pending', 'pickup'));

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
  v_delivery_method text := lower(trim(coalesce(p_customer->>'deliveryMethod', 'delivery')));
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

  if v_delivery_method = 'pickup' then
    if not v_settings.local_pickup_enabled then
      raise exception 'Retirada no local indisponível';
    end if;
    return jsonb_build_object('amount', 0, 'status', 'pickup');
  end if;

  if v_delivery_method <> 'delivery' then
    raise exception 'Forma de recebimento inválida';
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

update public.store_settings
set local_pickup_enabled = true,
    local_pickup_instructions = 'O endereço e o horário de retirada serão confirmados pelo WhatsApp.'
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id = 'default';

revoke all on function public.calculate_storefront_shipping(uuid, jsonb, numeric) from public;
grant execute on function public.calculate_storefront_shipping(uuid, jsonb, numeric) to service_role;

commit;
