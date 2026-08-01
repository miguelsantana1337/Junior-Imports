-- Permite que a loja calcule e exiba somente campanhas ativas e vigentes.
-- Carteiras, lançamentos e campanhas fora da vigência continuam protegidos.

grant select on table public.cashback_campaigns to anon;

drop policy if exists "public active cashback campaigns read"
  on public.cashback_campaigns;

create policy "public active cashback campaigns read"
  on public.cashback_campaigns
  for select
  to anon
  using (
    status = 'active'
    and starts_at <= now()
    and (ends_at is null or ends_at >= now())
  );
