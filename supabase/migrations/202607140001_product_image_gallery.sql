alter table public.products
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

update public.products
set image_urls = jsonb_build_array(image_url)
where image_url <> '' and image_urls = '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_image_urls_array_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_image_urls_array_check
      check (jsonb_typeof(image_urls) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_image_urls_limit_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_image_urls_limit_check
      check (jsonb_array_length(image_urls) <= 10);
  end if;
end $$;
