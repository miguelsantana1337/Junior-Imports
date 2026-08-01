-- Alinha as validações da campanha à semântica percentual usada pelo painel.
-- Exemplo: multiplier = 1 representa 1% do subtotal elegível.

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.cashback_campaigns'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%multiplier%'
  loop
    execute format(
      'alter table public.cashback_campaigns drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

alter table public.cashback_campaigns
  add constraint cashback_campaigns_percentage_check
  check (multiplier >= 0.1 and multiplier <= 100);

alter table public.cashback_campaigns
  add constraint cashback_campaigns_reward_positive_check
  check (multiplier > 0 or fixed_bonus > 0);
