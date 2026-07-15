-- Última linha de defesa para cadastros simultâneos ou clientes desatualizados.
-- O painel já envia slugs únicos; o gatilho mantém a mesma garantia no banco.
create or replace function public.ensure_unique_product_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate_slug text;
  suffix integer := 2;
begin
  base_slug := coalesce(nullif(btrim(new.slug), ''), 'produto-' || left(md5(new.id), 8));
  candidate_slug := base_slug;

  while exists (
    select 1
    from public.products
    where tenant_id = new.tenant_id
      and slug = candidate_slug
      and id <> new.id
  ) loop
    candidate_slug := base_slug || '-' || suffix;
    suffix := suffix + 1;
  end loop;

  new.slug := candidate_slug;
  return new;
end;
$$;

drop trigger if exists products_ensure_unique_slug on public.products;
create trigger products_ensure_unique_slug
before insert or update of slug, tenant_id on public.products
for each row execute function public.ensure_unique_product_slug();
