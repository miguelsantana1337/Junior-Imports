alter table public.store_settings
  add column if not exists logo_url text not null default '',
  add column if not exists favicon_url text not null default '',
  add column if not exists secondary_color text not null default '#69a8ff',
  add column if not exists background_color text not null default '#07090d',
  add column if not exists text_color text not null default '#f5f7fb',
  add column if not exists font_family text not null default 'Inter' check (font_family in ('Inter', 'Manrope', 'Poppins', 'System')),
  add column if not exists header_layout text not null default 'left' check (header_layout in ('left', 'center')),
  add column if not exists content_width integer not null default 1240 check (content_width between 960 and 1600),
  add column if not exists border_radius integer not null default 22 check (border_radius between 0 and 40);

alter table public.banners
  add column if not exists image_only boolean not null default false;

create table if not exists public.store_pages (
  id text primary key,
  name text not null,
  slug text not null unique,
  title text not null,
  description text not null default '',
  active boolean not null default true,
  show_in_navigation boolean not null default true,
  is_home boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_pages_single_home on public.store_pages (is_home) where is_home = true;

create table if not exists public.page_blocks (
  id text primary key,
  page_id text not null references public.store_pages(id) on delete cascade,
  kind text not null check (kind in ('hero', 'trust', 'featured', 'catalog', 'promo', 'benefits', 'faq', 'text', 'image', 'cta', 'spacer')),
  name text not null,
  eyebrow text not null default '',
  title text not null default '',
  body text not null default '',
  button_text text not null default '',
  button_link text not null default '',
  image_url text not null default '',
  background_color text not null default '',
  text_color text not null default '',
  container_width text not null default 'normal' check (container_width in ('narrow', 'normal', 'wide', 'full')),
  padding_size text not null default 'medium' check (padding_size in ('none', 'small', 'medium', 'large')),
  columns_count integer not null default 1 check (columns_count between 1 and 4),
  active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists page_blocks_page_order on public.page_blocks (page_id, order_index);

create table if not exists public.message_automations (
  id text primary key,
  name text not null,
  trigger_status text not null check (trigger_status in ('Novo', 'Aguardando pagamento', 'Pago', 'Preparando', 'Enviado', 'Entregue', 'Cancelado')),
  channel text not null check (channel in ('whatsapp', 'email')),
  subject text not null default '',
  message text not null,
  active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_logs (
  id text primary key default gen_random_uuid()::text,
  order_id text references public.orders(id) on delete cascade,
  order_code text not null,
  automation_id text references public.message_automations(id) on delete set null,
  automation_name text not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  recipient text not null,
  subject text not null default '',
  message text not null,
  status text not null default 'simulated' check (status in ('simulated', 'queued', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists message_logs_created_at on public.message_logs (created_at desc);

insert into public.store_pages (id, name, slug, title, description, active, show_in_navigation, is_home, order_index) values
  ('home', 'Página inicial', 'inicio', 'Junior Imports', 'Página principal da loja.', true, false, true, 1),
  ('page-about', 'Sobre nós', 'sobre', 'Sobre a Junior Imports', 'Conheça o projeto demonstrativo e a proposta da loja.', true, true, false, 2)
on conflict (id) do nothing;

insert into public.page_blocks (id, page_id, kind, name, eyebrow, title, body, button_text, button_link, image_url, background_color, text_color, container_width, padding_size, columns_count, active, order_index) values
  ('block-home-hero', 'home', 'hero', 'Banners principais', '', '', '', '', '', '', '', '', 'full', 'none', 1, true, 1),
  ('block-home-trust', 'home', 'trust', 'Faixa de confiança', '', '', '', '', '', '', '', '', 'full', 'none', 4, true, 2),
  ('block-home-featured', 'home', 'featured', 'Produtos em destaque', '', '', '', '', '', '', '', '', 'normal', 'large', 4, true, 3),
  ('block-home-catalog', 'home', 'catalog', 'Catálogo completo', '', '', '', '', '', '', '', '', 'normal', 'large', 4, true, 4),
  ('block-home-promo', 'home', 'promo', 'Campanha promocional', '', '', '', '', '', '', '', '', 'normal', 'large', 1, true, 5),
  ('block-home-benefits', 'home', 'benefits', 'Benefícios', '', '', '', '', '', '', '', '', 'normal', 'large', 4, true, 6),
  ('block-home-faq', 'home', 'faq', 'Dúvidas frequentes', '', '', '', '', '', '', '', '', 'normal', 'large', 1, true, 7),
  ('block-about-text', 'page-about', 'text', 'Apresentação', 'NOSSA HISTÓRIA', 'Uma loja demonstrativa construída para evoluir.', 'A Junior Imports reúne catálogo, carrinho, checkout e gestão em uma experiência completa. Este ambiente não realiza vendas reais e pode ser personalizado pelo painel administrativo.', 'Ver produtos', '/#catalogo', '', '#0e1117', '#f5f7fb', 'narrow', 'large', 1, true, 1),
  ('block-about-cta', 'page-about', 'cta', 'Chamada para o catálogo', 'EXPLORE A LOJA', 'Conheça o catálogo demonstrativo.', 'Veja produtos, simule um pedido e acompanhe o resultado no painel.', 'Abrir catálogo', '/#catalogo', '', '#0d2f65', '#ffffff', 'normal', 'medium', 1, true, 2)
on conflict (id) do nothing;

insert into public.message_automations (id, name, trigger_status, channel, subject, message, active, order_index) values
  ('automation-new', 'Pedido recebido', 'Novo', 'whatsapp', '', 'Olá, {{cliente}}! Recebemos o pedido demonstrativo {{pedido}} no valor de {{total}}.', true, 1),
  ('automation-paid', 'Pagamento confirmado', 'Pago', 'email', 'Pagamento confirmado — {{pedido}}', 'Olá, {{cliente}}! O pagamento demonstrativo do pedido {{pedido}} foi marcado como confirmado.', true, 2),
  ('automation-shipped', 'Pedido enviado', 'Enviado', 'whatsapp', '', 'Olá, {{cliente}}! O pedido demonstrativo {{pedido}} foi atualizado para Enviado.', true, 3)
on conflict (id) do nothing;

create or replace function public.queue_new_order_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  automation public.message_automations%rowtype;
  rendered_subject text;
  rendered_message text;
begin
  for automation in select * from public.message_automations where active = true and trigger_status = new.status loop
    rendered_subject := replace(replace(replace(replace(automation.subject, '{{cliente}}', coalesce(new.customer->>'name', 'Cliente')), '{{pedido}}', new.code), '{{status}}', new.status), '{{total}}', 'R$ ' || replace(to_char(new.total, 'FM999G999G990D00'), '.', ','));
    rendered_message := replace(replace(replace(replace(automation.message, '{{cliente}}', coalesce(new.customer->>'name', 'Cliente')), '{{pedido}}', new.code), '{{status}}', new.status), '{{total}}', 'R$ ' || replace(to_char(new.total, 'FM999G999G990D00'), '.', ','));
    insert into public.message_logs (order_id, order_code, automation_id, automation_name, channel, recipient, subject, message, status)
    values (new.id, new.code, automation.id, automation.name, automation.channel, case when automation.channel = 'whatsapp' then coalesce(new.customer->>'phone', '') else coalesce(new.customer->>'email', '') end, rendered_subject, rendered_message, 'simulated');
  end loop;
  return new;
end;
$$;

drop trigger if exists on_demo_order_created_message on public.orders;
create trigger on_demo_order_created_message after insert on public.orders for each row execute function public.queue_new_order_message();

alter table public.store_pages enable row level security;
alter table public.page_blocks enable row level security;
alter table public.message_automations enable row level security;
alter table public.message_logs enable row level security;

create policy "public active pages" on public.store_pages for select to anon, authenticated using (active or public.is_admin());
create policy "public active page blocks" on public.page_blocks for select to anon, authenticated using (active or public.is_admin());
create policy "admin pages" on public.store_pages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin page blocks" on public.page_blocks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin message automations" on public.message_automations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin message logs" on public.message_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true) on conflict (id) do update set public = excluded.public;
create policy "public site media read" on storage.objects for select to anon, authenticated using (bucket_id = 'site-media');
create policy "admin site media insert" on storage.objects for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());
create policy "admin site media update" on storage.objects for update to authenticated using (bucket_id = 'site-media' and public.is_admin()) with check (bucket_id = 'site-media' and public.is_admin());
create policy "admin site media delete" on storage.objects for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());
