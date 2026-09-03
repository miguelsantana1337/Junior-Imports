begin;

-- Produtos importados podem ser vendidos sob encomenda, sem inventar saldo
-- físico. Preços vinculados ao dólar guardam a referência comercial usada
-- pelo lojista e a última cotação aplicada.
alter table public.products
  add column if not exists made_to_order boolean not null default false,
  add column if not exists currency_pricing_enabled boolean not null default false,
  add column if not exists currency_base_price numeric(12,2),
  add column if not exists currency_base_rate numeric(12,6),
  add column if not exists currency_base_date date,
  add column if not exists currency_last_rate numeric(12,6),
  add column if not exists currency_last_rate_date date,
  add column if not exists currency_price_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_currency_pricing_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_currency_pricing_check check (
      not currency_pricing_enabled
      or (
        currency_base_price is not null and currency_base_price >= 0
        and currency_base_rate is not null and currency_base_rate > 0
        and currency_base_date is not null
      )
    ) not valid;
  end if;
end;
$$;

create table if not exists public.currency_rates (
  source text not null,
  rate_date date not null,
  quote_currency text not null default 'USD',
  base_currency text not null default 'BRL',
  sell_rate numeric(12,6) not null check (sell_rate between 1 and 20),
  quoted_at text not null default '',
  created_at timestamptz not null default now(),
  primary key (source, rate_date, quote_currency, base_currency)
);

alter table public.currency_rates enable row level security;
revoke all on table public.currency_rates from public, anon, authenticated;

insert into public.currency_rates (source, rate_date, quote_currency, base_currency, sell_rate, quoted_at)
values ('BCB_PTAX_SELL', date '2026-09-02', 'USD', 'BRL', 5.127300, '2026-09-02 13:02:37.000')
on conflict (source, rate_date, quote_currency, base_currency) do update set
  sell_rate = excluded.sell_rate,
  quoted_at = excluded.quoted_at;

create or replace function public.prepare_currency_linked_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric(12,6);
  v_rate_date date;
begin
  if not new.currency_pricing_enabled then return new; end if;

  if new.currency_base_price is null
    or new.currency_base_rate is null
    or new.currency_base_date is null
    or (
      tg_op = 'UPDATE'
      and new.price is distinct from old.price
      and new.currency_last_rate is not distinct from old.currency_last_rate
    )
  then
    select sell_rate, rate_date into v_rate, v_rate_date
    from public.currency_rates
    where source = 'BCB_PTAX_SELL'
      and quote_currency = 'USD'
      and base_currency = 'BRL'
    order by rate_date desc
    limit 1;

    if v_rate is null then
      raise exception 'Não há cotação válida para vincular este preço ao dólar';
    end if;

    new.currency_base_price := new.price;
    new.currency_base_rate := v_rate;
    new.currency_base_date := v_rate_date;
    new.currency_last_rate := v_rate;
    new.currency_last_rate_date := v_rate_date;
    new.currency_price_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_currency_linked_product on public.products;
create trigger prepare_currency_linked_product
before insert or update of price, currency_pricing_enabled, currency_base_price, currency_base_rate,
  currency_base_date, currency_last_rate, currency_last_rate_date
on public.products
for each row execute function public.prepare_currency_linked_product();

create or replace function public.refresh_usd_linked_product_prices(
  p_rate numeric,
  p_rate_date date,
  p_source text default 'BCB_PTAX_SELL'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
  v_tenant record;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso negado'; end if;
  if p_source <> 'BCB_PTAX_SELL' then raise exception 'Fonte cambial não permitida'; end if;
  if p_rate is null or p_rate < 1 or p_rate > 20 then raise exception 'Cotação inválida'; end if;
  if p_rate_date is null or p_rate_date > current_date + 1 or p_rate_date < current_date - 10 then
    raise exception 'Data da cotação inválida';
  end if;

  insert into public.currency_rates (source, rate_date, quote_currency, base_currency, sell_rate)
  values (p_source, p_rate_date, 'USD', 'BRL', round(p_rate, 6))
  on conflict (source, rate_date, quote_currency, base_currency) do update set
    sell_rate = excluded.sell_rate;

  update public.products
  set
    price = round(currency_base_price * p_rate / currency_base_rate, 2),
    currency_last_rate = round(p_rate, 6),
    currency_last_rate_date = p_rate_date,
    currency_price_updated_at = now(),
    updated_at = now()
  where currency_pricing_enabled = true
    and currency_base_price is not null
    and currency_base_rate > 0
    and deleted_at is null
    and (
      currency_last_rate is distinct from round(p_rate, 6)
      or currency_last_rate_date is distinct from p_rate_date
    );
  get diagnostics v_updated = row_count;

  for v_tenant in
    select tenant_id, count(*)::integer as product_count
    from public.products
    where currency_pricing_enabled = true and deleted_at is null
    group by tenant_id
  loop
    insert into public.audit_logs
      (tenant_id, actor_id, actor_email, action, entity_type, entity_id, entity_label, before_data, after_data)
    values (
      v_tenant.tenant_id, null, 'cron:exchange-rate', 'update', 'currency_pricing',
      p_source || ':' || p_rate_date::text, 'Atualização diária do dólar', null,
      jsonb_build_object('rate', p_rate, 'rate_date', p_rate_date, 'source', p_source, 'linked_products', v_tenant.product_count)
    );
  end loop;

  return jsonb_build_object('updated_products', v_updated, 'rate', p_rate, 'rate_date', p_rate_date, 'source', p_source);
end;
$$;

revoke all on function public.refresh_usd_linked_product_prices(numeric, date, text)
  from public, anon, authenticated;
grant execute on function public.refresh_usd_linked_product_prices(numeric, date, text)
  to service_role;

-- A vitrine expõe apenas que o item é sob encomenda e uma data de atualização,
-- nunca o saldo físico, custo ou parâmetros internos do câmbio.
create or replace function public.storefront_product_availability(
  p_tenant_id uuid,
  p_product_id text
)
returns table (
  availability text,
  purchase_limit integer
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with available_stock as (
    select
      product.made_to_order,
      greatest(
        0,
        product.stock - coalesce(sum(reservation.quantity) filter (
          where reservation.status = 'active'
            and reservation.expires_at > now()
        ), 0)
      )::integer as quantity
    from public.products product
    join public.tenants tenant
      on tenant.id = product.tenant_id
     and tenant.status in ('trial', 'active')
    left join public.order_stock_reservations reservation
      on reservation.tenant_id = product.tenant_id
     and reservation.product_id = product.id
    where product.tenant_id = p_tenant_id
      and product.id = p_product_id
      and product.active = true
    group by product.stock, product.made_to_order
  )
  select
    case
      when made_to_order then 'made_to_order'
      when quantity <= 0 then 'out_of_stock'
      when quantity <= 5 then 'low_stock'
      else 'in_stock'
    end,
    case when made_to_order then 10 else least(10, quantity) end
  from available_stock;
$$;

grant select (made_to_order, currency_pricing_enabled, currency_price_updated_at)
  on table public.products to anon;

drop view if exists public.storefront_products;
create view public.storefront_products
with (security_barrier = true, security_invoker = true)
as
select
  product.tenant_id,
  product.id,
  product.slug,
  product.name,
  product.category_id,
  product.brand,
  product.price,
  product.compare_at,
  product.cashback,
  product.cashback_type,
  product.badge,
  product.accent,
  product.description,
  product.featured,
  product.active,
  product.order_index,
  product.image_url,
  product.image_urls,
  product.product_type,
  product.regulatory_status,
  product.active_ingredient,
  product.anvisa_registration,
  product.presentation,
  product.regulatory_warning,
  product.pharmacist_reviewed,
  product.made_to_order,
  product.currency_pricing_enabled,
  product.currency_price_updated_at,
  stock_status.availability,
  stock_status.purchase_limit
from public.products product
cross join lateral public.storefront_product_availability(product.tenant_id, product.id) stock_status
where product.active = true
  and product.deleted_at is null
  and public.is_public_tenant(product.tenant_id);

revoke all on table public.storefront_products from public, anon, authenticated;
grant select on table public.storefront_products to anon, authenticated;

-- Mantém o checkout seguro, mas ignora validação e reserva de estoque somente
-- para linhas explicitamente marcadas como sob encomenda.
do $$
declare
  current_definition text;
  updated_definition text;
  stock_check text := $needle$
    select coalesce(sum(quantity), 0)::integer into v_reserved
    from public.order_stock_reservations
    where tenant_id = p_tenant_id
      and product_id = v_product.id
      and status = 'active'
      and expires_at > now();
    v_available := greatest(0, v_product.stock - v_reserved);
    if v_available < v_quantity then raise exception 'Produto indisponível ou sem estoque suficiente'; end if;
$needle$;
  made_to_order_stock_check text := $replacement$
    if not coalesce(v_product.made_to_order, false) then
      select coalesce(sum(quantity), 0)::integer into v_reserved
      from public.order_stock_reservations
      where tenant_id = p_tenant_id
        and product_id = v_product.id
        and status = 'active'
        and expires_at > now();
      v_available := greatest(0, v_product.stock - v_reserved);
      if v_available < v_quantity then raise exception 'Produto indisponível ou sem estoque suficiente'; end if;
    end if;
$replacement$;
  reservation_insert text := $needle$
    insert into public.order_stock_reservations
      (tenant_id, order_id, product_id, quantity, status, expires_at)
    values
      (p_tenant_id, v_order_id, v_product.id, v_quantity, 'active', v_expires_at);
$needle$;
  conditional_reservation_insert text := $replacement$
    if not coalesce(v_product.made_to_order, false) then
      insert into public.order_stock_reservations
        (tenant_id, order_id, product_id, quantity, status, expires_at)
      values
        (p_tenant_id, v_order_id, v_product.id, v_quantity, 'active', v_expires_at);
    end if;
$replacement$;
begin
  select pg_get_functiondef(
    'public.create_tenant_order_secure(uuid,jsonb,jsonb,text,text,uuid,text,text,text,integer)'::regprocedure
  ) into current_definition;

  updated_definition := replace(current_definition, stock_check, made_to_order_stock_check);
  if updated_definition = current_definition then
    raise exception 'Não foi possível adaptar a validação de estoque para encomendas';
  end if;

  current_definition := updated_definition;
  updated_definition := replace(current_definition, reservation_insert, conditional_reservation_insert);
  if updated_definition = current_definition then
    raise exception 'Não foi possível adaptar a reserva de estoque para encomendas';
  end if;
  execute updated_definition;
end;
$$;

-- Catálogo Apple aprovado pelo usuário. Os valores mínimos informados são a
-- referência em BRL para a PTAX de venda de 02/09/2026 (R$ 5,1273 por US$ 1).
do $$
declare
  v_tenant_id uuid;
  v_category_id text;
  v_first_order integer;
begin
  select id into v_tenant_id
  from public.tenants
  where slug = 'junior-imports'
  limit 1;
  if v_tenant_id is null then raise exception 'Loja Junior Imports não encontrada'; end if;

  select id into v_category_id
  from public.categories
  where tenant_id = v_tenant_id and slug = 'eletronicos'
  limit 1;

  if v_category_id is null then
    v_category_id := 'eletronicos-' || left(replace(v_tenant_id::text, '-', ''), 12);
    insert into public.categories (tenant_id, id, name, slug, active, order_index)
    values (v_tenant_id, v_category_id, 'Eletrônicos', 'eletronicos', true, 0);
  end if;

  select coalesce(max(order_index), 0) into v_first_order
  from public.products where tenant_id = v_tenant_id;

  insert into public.products (
    tenant_id, id, slug, name, category_id, brand, price, compare_at, stock,
    badge, accent, description, sku, rating, reviews, featured, active,
    order_index, image_url, image_urls, product_type, regulatory_status,
    cost_price, min_stock, cashback, cashback_type, made_to_order,
    currency_pricing_enabled, currency_base_price, currency_base_rate,
    currency_base_date, currency_last_rate, currency_last_rate_date,
    currency_price_updated_at
  )
  select
    v_tenant_id,
    'apple-202609-' || lpad(catalog.position::text, 3, '0'),
    catalog.slug,
    catalog.name,
    v_category_id,
    'Apple',
    catalog.price,
    0,
    0,
    'Sob encomenda',
    '#1677ff',
    catalog.name || '. Produto sob encomenda. Consulte cor, condição, prazo e disponibilidade com a equipe antes de confirmar o pedido.',
    'JI-APPLE-' || lpad(catalog.position::text, 3, '0'),
    0,
    0,
    catalog.position = 1,
    true,
    v_first_order + catalog.position,
    catalog.image_url,
    jsonb_build_array(catalog.image_url),
    'non_medicine',
    'approved',
    0,
    0,
    0,
    'fixed',
    true,
    true,
    catalog.price,
    5.127300,
    date '2026-09-02',
    5.127300,
    date '2026-09-02',
    now()
  from (values
    (1, 'iphone-15-128gb', 'iPhone 15 128GB', 2930.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone_15_hero.png'),
    (2, 'iphone-16-128gb', 'iPhone 16 128GB', 4320.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-16.png'),
    (3, 'iphone-17e-256gb', 'iPhone 17e 256GB', 4230.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-17e.png'),
    (4, 'iphone-17-256gb', 'iPhone 17 256GB', 5200.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-17-hero.png'),
    (5, 'iphone-17-pro-256gb', 'iPhone 17 Pro 256GB', 7800.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-17-pro-17-pro-max-hero.png'),
    (6, 'iphone-17-pro-512gb', 'iPhone 17 Pro 512GB', 9350.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-17-pro-17-pro-max-hero.png'),
    (7, 'iphone-17-pro-max-256gb', 'iPhone 17 Pro Max 256GB', 8300.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-17-pro-17-pro-max-hero.png'),
    (8, 'iphone-17-pro-max-512gb', 'iPhone 17 Pro Max 512GB', 9500.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-17-pro-17-pro-max-hero.png'),
    (9, 'iphone-17-pro-max-1tb', 'iPhone 17 Pro Max 1TB', 12000.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-17-pro-17-pro-max-hero.png'),
    (10, 'apple-watch-se-3-40mm', 'Apple Watch SE 3 40mm', 1850.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/apple-watch-se-3-hero.png'),
    (11, 'apple-watch-se-3-44mm', 'Apple Watch SE 3 44mm', 1850.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/apple-watch-se-3-hero.png'),
    (12, 'apple-watch-series-11-42mm', 'Apple Watch Series 11 42mm', 2600.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/apple-watch-series-11-hero.png'),
    (13, 'apple-watch-series-11-46mm', 'Apple Watch Series 11 46mm', 3000.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/apple-watch-series-11-hero.png'),
    (14, 'apple-watch-ultra-3-49mm', 'Apple Watch Ultra 3 49mm', 6400.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/apple-watch-ultra-3-hero.png'),
    (15, 'ipad-air-5-64gb', 'iPad Air 5 64GB', 2800.00, 'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111887_sp866-ipad-air-5gen.png'),
    (16, 'ipad-11-a16-128gb', 'iPad 11 A16 128GB', 2900.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/122240-ipad-a16.png'),
    (17, 'ipad-11-a16-256gb', 'iPad 11 A16 256GB', 5300.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/122240-ipad-a16.png'),
    (18, 'macbook-air-m5-13-16-512', 'MacBook Air M5 13,6" 16GB/512GB', 7000.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/macbook-air-13-inch-m5.png'),
    (19, 'macbook-air-m5-15-16-512', 'MacBook Air M5 15,3" 16GB/512GB', 10000.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/macbook-air-15-inch-m5.png'),
    (20, 'airpods-4-com-anc', 'AirPods 4 com ANC', 1387.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/121204-airpods-4-anc.png'),
    (21, 'airpods-4-sem-anc', 'AirPods 4 sem ANC', 1200.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/121203-airpods-4.png'),
    (22, 'airpods-pro-3', 'AirPods Pro 3', 2188.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/airpods-pro-3-hero.png'),
    (23, 'airpods-pro-2', 'AirPods Pro 2', 2300.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/airpods-pro-2.png'),
    (24, 'apple-pencil-usb-c', 'Apple Pencil USB-C', 600.00, 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/ipad-apple-pencil-witb-202310.png'),
    (25, 'apple-pencil-2', 'Apple Pencil 2', 700.00, 'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111889_apple-pencil-2.png'),
    (26, 'airtag-4-pack', 'AirTag 4 Pack', 1100.00, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airtag-4pack-select-202601?wid=890&hei=740&fmt=jpeg&qlt=90&.v=1767653157914')
  ) as catalog(position, slug, name, price, image_url)
  on conflict (tenant_id, sku) do nothing;
end;
$$;

alter table public.products validate constraint products_currency_pricing_check;

commit;
