-- Reforça as regras da mega atualização no caminho seguro do checkout.

create or replace function public.coupon_applicable_subtotal(
  p_tenant_id uuid,
  p_coupon_id text,
  p_items jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal numeric(12,2) := 0;
  v_has_categories boolean;
  v_has_products boolean;
begin
  select * into v_coupon
  from public.coupons
  where tenant_id = p_tenant_id and id = p_coupon_id;

  if not found then return 0; end if;
  v_has_categories := coalesce(array_length(v_coupon.applicable_category_ids, 1), 0) > 0;
  v_has_products := coalesce(array_length(v_coupon.applicable_product_ids, 1), 0) > 0;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_quantity := greatest(0, least(coalesce((v_item->>'quantity')::integer, 0), 100));
    select * into v_product
    from public.products
    where tenant_id = p_tenant_id
      and id = v_item->>'product_id'
      and active = true;

    if found and (
      (not v_has_categories and not v_has_products)
      or (v_has_categories and v_product.category_id = any(v_coupon.applicable_category_ids))
      or (v_has_products and v_product.id = any(v_coupon.applicable_product_ids))
    ) then
      v_subtotal := v_subtotal + (v_product.price * v_quantity);
    end if;
  end loop;

  return v_subtotal;
end;
$$;

do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.validate_storefront_coupon(uuid,jsonb,text,text,text)'::regprocedure
  ) into current_definition;

  updated_definition := replace(
    current_definition,
    'v_discount numeric(12,2) := 0;',
    'v_discount numeric(12,2) := 0;' || chr(10) || '  v_applicable_subtotal numeric(12,2) := 0;'
  );
  updated_definition := replace(
    updated_definition,
    'if v_coupon.minimum > v_subtotal then',
    'v_applicable_subtotal := public.coupon_applicable_subtotal(p_tenant_id, v_coupon.id, p_items);' || chr(10) || '  if v_coupon.minimum > v_applicable_subtotal then'
  );
  updated_definition := replace(
    updated_definition,
    'when v_coupon.discount_type = ''percent'' then v_subtotal * v_coupon.value / 100' || chr(10) || '    else v_coupon.value',
    'when v_coupon.discount_type = ''percent'' then v_applicable_subtotal * v_coupon.value / 100' || chr(10) || '    else least(v_coupon.value, v_applicable_subtotal)'
  );
  if updated_definition = current_definition or position('v_applicable_subtotal' in updated_definition) = 0 then
    raise exception 'Não foi possível aplicar a restrição de escopo ao validador de cupons';
  end if;
  execute updated_definition;
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
    'v_coupon public.coupons%rowtype;',
    'v_coupon public.coupons%rowtype;' || chr(10) || '  v_applicable_subtotal numeric(12,2) := 0;'
  );
  updated_definition := replace(
    updated_definition,
    'if v_coupon.minimum > v_subtotal then',
    'v_applicable_subtotal := public.coupon_applicable_subtotal(p_tenant_id, v_coupon.id, p_items);' || chr(10) || '    if v_coupon.minimum > v_applicable_subtotal then'
  );
  updated_definition := replace(
    updated_definition,
    'when v_coupon.discount_type = ''percent'' then v_subtotal * v_coupon.value / 100' || chr(10) || '      else v_coupon.value',
    'when v_coupon.discount_type = ''percent'' then v_applicable_subtotal * v_coupon.value / 100' || chr(10) || '      else least(v_coupon.value, v_applicable_subtotal)'
  );
  if updated_definition = current_definition or position('v_applicable_subtotal' in updated_definition) = 0 then
    raise exception 'Não foi possível aplicar a restrição de escopo ao criador de pedidos';
  end if;
  execute updated_definition;
end;
$$;

grant execute on function public.coupon_applicable_subtotal(uuid, text, jsonb) to service_role;
