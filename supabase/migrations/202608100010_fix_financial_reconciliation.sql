begin;

-- Pedidos antigos usam a entrada consolidada `order-income:*`. Nos pagamentos
-- parcelados essa entrada é cancelada e as parcelas permanecem como `paid`.
-- Portanto, a conferência correta é a soma de todas as entradas pagas ligadas
-- ao pedido, sem excluir a entrada consolidada.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.scan_operational_divergences(uuid)'::regprocedure)
    into v_definition;
  v_definition := replace(
    v_definition,
    $needle$      and coalesce(ft.external_key, '') <> 'order-income:' || o.id
$needle$,
    ''
  );
  execute v_definition;
end;
$$;

create or replace function public.suppress_reconciled_financial_divergence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount_paid numeric(12,2);
  v_finance_income numeric(12,2);
begin
  if new.rule_key <> 'payment_finance_mismatch' or new.entity_type <> 'order' then
    return new;
  end if;

  select
    round(coalesce(o.amount_paid, 0), 2),
    round(coalesce((
      select sum(ft.amount)
      from public.financial_transactions ft
      where ft.tenant_id = o.tenant_id
        and ft.order_id = o.id
        and ft.type = 'income'
        and ft.status = 'paid'
    ), 0), 2)
  into v_amount_paid, v_finance_income
  from public.orders o
  where o.tenant_id = new.tenant_id and o.id = new.entity_id;

  if found and abs(v_amount_paid - v_finance_income) < 0.01 then
    new.status := 'resolved';
    new.resolution_reason := 'A entrada financeira consolidada ou as parcelas pagas conferem com o pedido.';
    new.resolved_at := now();
    new.resolved_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists suppress_reconciled_financial_divergence on public.operational_divergences;
create trigger suppress_reconciled_financial_divergence
before insert or update on public.operational_divergences
for each row execute function public.suppress_reconciled_financial_divergence();

update public.operational_divergences divergence
set
  status = 'resolved',
  resolution_reason = 'A entrada financeira consolidada ou as parcelas pagas conferem com o pedido.',
  resolved_at = now(),
  resolved_by = null,
  updated_at = now()
where divergence.rule_key = 'payment_finance_mismatch'
  and exists (
    select 1
    from public.orders o
    where o.tenant_id = divergence.tenant_id
      and o.id = divergence.entity_id
      and abs(
        round(coalesce(o.amount_paid, 0), 2)
        - round(coalesce((
          select sum(ft.amount)
          from public.financial_transactions ft
          where ft.tenant_id = o.tenant_id
            and ft.order_id = o.id
            and ft.type = 'income'
            and ft.status = 'paid'
        ), 0), 2)
      ) < 0.01
  );

revoke all on function public.suppress_reconciled_financial_divergence() from public, anon, authenticated;

commit;
