-- Recupera os dois pedidos confirmados pelo atendimento que haviam sido
-- cancelados exclusivamente pela expiração automática da reserva.

do $$
declare
  tenant_id_constant constant uuid := '00000000-0000-4000-8000-000000000100';
  permanent_reservation constant timestamptz := '9999-12-31 23:59:59+00'::timestamptz;
  target record;
  order_row public.orders%rowtype;
  reservation_row record;
  reservation_count integer;
  balance_after integer;
  order_cost numeric(12,2);
begin
  for target in
    select *
    from (
      values
        ('6f5bbf10-a972-451b-8c97-86e33835ba15'::text, 'JI-1022'::text),
        ('d5de2923-e447-4f85-89cb-4654d906ad97'::text, 'JI-1023'::text)
    ) as confirmed_order(id, code)
  loop
    select *
    into order_row
    from public.orders
    where tenant_id = tenant_id_constant
      and id = target.id
      and code = target.code
    for update;

    if not found then
      raise exception 'Pedido % não foi encontrado para recuperação', target.code;
    end if;

    if order_row.status <> 'Cancelado' then
      raise exception 'Pedido % está em %, não em Cancelado', target.code, order_row.status;
    end if;

    select count(*)
    into reservation_count
    from public.order_stock_reservations
    where tenant_id = tenant_id_constant
      and order_id = target.id
      and status = 'expired';

    if reservation_count = 0 then
      raise exception 'Pedido % não possui reserva expirada para recuperar', target.code;
    end if;

    for reservation_row in
      select
        reservation.*,
        coalesce(item.unit_cost, 0) as unit_cost
      from public.order_stock_reservations reservation
      join public.order_items item
        on item.tenant_id = reservation.tenant_id
       and item.order_id = reservation.order_id
       and item.product_id = reservation.product_id
      where reservation.tenant_id = tenant_id_constant
        and reservation.order_id = target.id
        and reservation.status = 'expired'
      order by reservation.product_id
      for update of reservation
    loop
      if exists (
        select 1
        from public.inventory_movements movement
        where movement.tenant_id = tenant_id_constant
          and movement.id = 'sale-' || target.id || '-' || reservation_row.product_id
      ) then
        raise exception 'Pedido % já possui baixa de estoque para o produto %',
          target.code,
          reservation_row.product_id;
      end if;

      update public.products
      set stock = stock - reservation_row.quantity,
          updated_at = now()
      where tenant_id = tenant_id_constant
        and id = reservation_row.product_id
        and stock >= reservation_row.quantity
      returning stock into balance_after;

      if not found then
        raise exception 'Estoque insuficiente para recuperar o pedido %', target.code;
      end if;

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
          'sale-' || target.id || '-' || reservation_row.product_id,
          reservation_row.product_id,
          'sale',
          -reservation_row.quantity,
          balance_after,
          reservation_row.unit_cost,
          'order',
          target.id,
          'Baixa confirmada após recuperação do pedido ' || target.code
        );

      update public.order_stock_reservations
      set status = 'committed',
          expires_at = permanent_reservation,
          updated_at = now()
      where tenant_id = tenant_id_constant
        and order_id = target.id
        and product_id = reservation_row.product_id;
    end loop;

    select coalesce(sum(quantity * unit_cost), 0)
    into order_cost
    from public.order_items
    where tenant_id = tenant_id_constant
      and order_id = target.id;

    insert into public.financial_transactions
      (
        tenant_id,
        id,
        type,
        status,
        description,
        amount,
        category,
        account,
        cost_center,
        paid_at,
        order_id,
        notes,
        external_key
      )
    values
      (
        tenant_id_constant,
        'order-income-' || target.id,
        'income',
        'paid',
        'Venda ' || target.code,
        order_row.total,
        'Vendas',
        'Conta principal',
        'Comercial',
        now(),
        target.id,
        'Gerado na recuperação de pedido confirmado após expiração indevida.',
        'order-income:' || target.id
      )
    on conflict (tenant_id, external_key) where external_key <> ''
    do update set
      status = 'paid',
      amount = excluded.amount,
      paid_at = excluded.paid_at,
      updated_at = now();

    if order_cost > 0 then
      insert into public.financial_transactions
        (
          tenant_id,
          id,
          type,
          status,
          description,
          amount,
          category,
          account,
          cost_center,
          paid_at,
          order_id,
          notes,
          external_key
        )
      values
        (
          tenant_id_constant,
          'order-cogs-' || target.id,
          'expense',
          'paid',
          'Custo dos produtos - ' || target.code,
          order_cost,
          'CMV',
          'Estoque',
          'Operação',
          now(),
          target.id,
          'Custo congelado nos itens do pedido recuperado.',
          'order-cogs:' || target.id
        )
      on conflict (tenant_id, external_key) where external_key <> ''
      do update set
        status = 'paid',
        amount = excluded.amount,
        paid_at = excluded.paid_at,
        updated_at = now();
    end if;

    update public.orders
    set status = 'Pago',
        reservation_expires_at = permanent_reservation
    where tenant_id = tenant_id_constant
      and id = target.id;

    update public.coupon_redemptions
    set status = 'used',
        updated_at = now()
    where tenant_id = tenant_id_constant
      and order_id = target.id;

    update public.storefront_order_requests
    set response_data = jsonb_set(
          jsonb_set(
            coalesce(response_data, '{}'::jsonb),
            '{status}',
            to_jsonb('Pago'::text),
            true
          ),
          '{reservation_expires_at}',
          to_jsonb(permanent_reservation),
          true
        ),
        updated_at = now()
    where tenant_id = tenant_id_constant
      and order_id = target.id;
  end loop;
end;
$$;
