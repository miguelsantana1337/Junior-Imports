begin;

-- O pedido JI-1024 já havia produzido uma baixa idempotente de 19 para 18.
-- Uma edição manual posterior reduziu o mesmo produto de 18 para 17 sem um
-- segundo pedido. Esta reconciliação desfaz somente a redução duplicada.
do $$
declare
  tenant_id_constant constant uuid := '00000000-0000-4000-8000-000000000100';
  order_id_constant constant text := '885b4ec4-d88d-4dd9-ad73-9d5e0d43e773';
  product_id_constant constant text := '763e9c46-b01f-40ff-9091-2988e6ed9d8c';
  current_stock integer;
begin
  select stock
  into current_stock
  from public.products
  where tenant_id = tenant_id_constant
    and id = product_id_constant
  for update;

  if not found then
    raise exception 'Produto do pedido JI-1024 não encontrado';
  end if;

  if not exists (
    select 1
    from public.inventory_movements
    where tenant_id = tenant_id_constant
      and id = 'sale-' || order_id_constant || '-' || product_id_constant
      and type = 'sale'
      and quantity = -1
      and balance_after = 18
  ) then
    raise exception 'Baixa original do pedido JI-1024 não confere';
  end if;

  if current_stock = 18 then
    return;
  end if;

  if current_stock <> 17 or not exists (
    select 1
    from public.audit_logs
    where tenant_id = tenant_id_constant
      and entity_type = 'products'
      and entity_id = product_id_constant
      and before_data->>'stock' = '18'
      and after_data->>'stock' = '17'
      and created_at > '2026-07-20 15:27:48+00'::timestamptz
  ) then
    raise exception 'Saldo atual não permite reconciliar JI-1024 com segurança';
  end if;

  update public.products
  set stock = 18,
      updated_at = now()
  where tenant_id = tenant_id_constant
    and id = product_id_constant;

  insert into public.inventory_movements
    (
      tenant_id,
      id,
      product_id,
      type,
      quantity,
      balance_after,
      unit_cost,
      reference_type,
      reference_id,
      note
    )
  values
    (
      tenant_id_constant,
      'reconcile-duplicate-manual-JI-1024-' || product_id_constant,
      product_id_constant,
      'adjustment',
      1,
      18,
      0,
      'order',
      order_id_constant,
      'Correção da redução manual duplicada após a baixa confirmada do pedido JI-1024.'
    )
  on conflict (id) do nothing;
end;
$$;

commit;
