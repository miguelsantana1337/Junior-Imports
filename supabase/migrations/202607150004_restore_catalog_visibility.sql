-- Corrige a divergência entre o status "ativo" do painel e a vitrine.
-- Produtos ativos ficam visíveis para consulta; a função/trigger de pedidos
-- continua exigindo a validação regulatória antes de aceitar um item.
drop policy if exists "public tenant products" on public.products;

create policy "public tenant products" on public.products for select to anon, authenticated
using (
  (
    active
    and public.is_public_tenant(tenant_id)
  )
  or public.has_tenant_permission(tenant_id, 'catalog')
);
