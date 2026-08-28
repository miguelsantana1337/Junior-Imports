begin;

-- A vitrine precisa ler a campanha ativa para exibir e calcular o mesmo
-- percentual que o servidor aplicará ao pedido. Rascunhos e campanhas internas
-- continuam protegidos pelo RLS e visíveis somente a usuários autorizados.
drop policy if exists "public active cashback campaigns" on public.cashback_campaigns;
create policy "public active cashback campaigns"
on public.cashback_campaigns
for select
to anon, authenticated
using (
  status = 'active'
  and public.is_public_tenant(tenant_id)
);

grant select on table public.cashback_campaigns to anon, authenticated;

commit;
