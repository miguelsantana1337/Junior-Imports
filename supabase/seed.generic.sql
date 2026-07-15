-- Template preenchido automaticamente por scripts/create-client.mjs.
insert into public.store_settings (
  tenant_id, id, store_name, whatsapp, order_prefix, email, hours, announcement, footer_description,
  primary_color, secondary_color, free_shipping_threshold, shipping_flat,
  pix_discount, auto_banner_seconds, checkout_mode, whatsapp_message
)
values (
  '00000000-0000-4000-8000-000000000100', 'default', '__STORE_NAME_SQL__', '__WHATSAPP__', '__ORDER_PREFIX__', '__STORE_EMAIL_SQL__',
  'Segunda a sexta · 9h às 18h', 'Frete grátis em compras acima de {{valor}}',
  'Produtos selecionados, ofertas exclusivas e compra rápida.',
  '__PRIMARY_COLOR__', '__SECONDARY_COLOR__', 299, 24.90, 5, 6, 'whatsapp',
  $message$🛒 *Novo pedido – {{loja}}*

Olá! Gostaria de finalizar o seguinte pedido:

📦 *Pedido:* {{pedido}}

*Produtos:*
{{itens}}

💰 *Total do pedido:* {{total}}
💳 *Forma de pagamento:* {{pagamento}}
🎟️ *Cupom utilizado:* {{cupom}}

👤 *Cliente:* {{cliente}}

Aguardo a confirmação. Obrigado!$message$
)
on conflict (tenant_id, id) do update set
  store_name = excluded.store_name,
  whatsapp = excluded.whatsapp,
  order_prefix = excluded.order_prefix,
  email = excluded.email,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color;

insert into public.categories (id, name, slug, active, order_index) values
  ('cat-1', 'Destaques', 'destaques', true, 1),
  ('cat-2', 'Casa e estilo', 'casa-e-estilo', true, 2),
  ('cat-3', 'Acessórios', 'acessorios', true, 3)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  active = excluded.active,
  order_index = excluded.order_index;

insert into public.products (
  id, slug, name, category_id, brand, price, compare_at, stock, badge,
  accent, description, sku, rating, reviews, featured, active, order_index, image_url
) values
  ('produto-1', 'produto-essencial', 'Produto Essencial', 'cat-1', 'Marca Exemplo', 129.90, 159.90, 24, 'Mais vendido', '__PRIMARY_COLOR__', 'Produto disponível no catálogo demonstrativo da __STORE_NAME_SQL__.', '__ORDER_PREFIX__-001', 4.7, 8, true, true, 1, ''),
  ('produto-2', 'produto-premium', 'Produto Premium', 'cat-1', 'Marca Exemplo', 219.90, 249.90, 12, 'Novidade', '#6a58d8', 'Produto disponível no catálogo demonstrativo da __STORE_NAME_SQL__.', '__ORDER_PREFIX__-002', 4.8, 14, true, true, 2, ''),
  ('produto-3', 'item-para-casa', 'Item para Casa', 'cat-2', 'Casa Demo', 89.90, 109.90, 30, 'Oferta', '#1b9688', 'Produto disponível no catálogo demonstrativo da __STORE_NAME_SQL__.', '__ORDER_PREFIX__-003', 4.9, 20, false, true, 3, ''),
  ('produto-4', 'acessorio-versatil', 'Acessório Versátil', 'cat-3', 'Linha Demo', 59.90, 0, 45, '', '#d46a9e', 'Produto disponível no catálogo demonstrativo da __STORE_NAME_SQL__.', '__ORDER_PREFIX__-004', 5.0, 26, false, true, 4, '')
on conflict (id) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  sku = excluded.sku,
  active = excluded.active;

insert into public.banners (
  id, kicker, title, highlight, subtitle, button_text, button_link,
  start_color, end_color, image_url, image_only, active, order_index
) values
  ('banner-1', 'OFERTA DA SEMANA', 'Produtos selecionados com condições especiais.', 'condições especiais.', 'Explore o catálogo e simule um pedido em poucos passos.', 'Ver produtos', '#catalogo', '#07101f', '__PRIMARY_COLOR__', '', false, true, 1),
  ('banner-2', 'CUPOM DE BOAS-VINDAS', 'Use __COUPON_CODE__ e ganhe 10% de desconto.', '10% de desconto.', 'Uma campanha inicial pronta para ser personalizada no painel.', 'Usar cupom', '#catalogo', '#071d19', '#128a72', '', false, true, 2)
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  end_color = excluded.end_color,
  active = excluded.active;

insert into public.home_sections (
  id, kind, name, eyebrow, title, subtitle, button_text, button_link, active, order_index
) values
  ('section-featured', 'featured', 'Produtos em destaque', 'DESTAQUES DA LOJA', 'Os produtos mais procurados.', 'Seleção configurável pelo painel.', '', '', true, 1),
  ('section-catalog', 'catalog', 'Catálogo completo', 'TODOS OS PRODUTOS', 'Encontre o produto certo.', 'Busque, filtre e ordene o catálogo.', '', '', true, 2),
  ('section-promo', 'promo', 'Banner promocional', 'CONDIÇÃO ESPECIAL', 'Frete grátis acima de R$ 299.', 'Personalize esta oferta no painel administrativo.', 'Ver produtos', '#catalogo', true, 3),
  ('section-benefits', 'benefits', 'Benefícios', 'POR QUE COMPRAR', 'Uma experiência pensada para conversão.', '', '', '', true, 4),
  ('section-faq', 'faq', 'Dúvidas frequentes', 'PRECISA DE AJUDA?', 'Informação clara antes da compra.', '', '', '', true, 5)
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  active = excluded.active,
  order_index = excluded.order_index;

insert into public.coupons (id, code, discount_type, value, minimum, active)
values ('coupon-1', '__COUPON_CODE__', 'percent', 10, 0, true)
on conflict (id) do update set code = excluded.code, value = excluded.value, active = excluded.active;

insert into public.trust_items (id, title, subtitle, order_index) values
  ('trust-1', 'Compra rápida', 'Checkout em poucos passos', 1),
  ('trust-2', 'Pagamento simulado', 'Pix, cartão ou boleto', 2),
  ('trust-3', 'Frete demonstrativo', 'Grátis acima de R$ 299', 3),
  ('trust-4', 'Suporte direto', 'Atendimento por WhatsApp', 4)
on conflict (id) do update set title = excluded.title, subtitle = excluded.subtitle, order_index = excluded.order_index;

insert into public.benefits (id, title, text, order_index) values
  ('benefit-1', 'Ofertas visíveis', 'Preço, desconto e condições apresentados diretamente no produto.', 1),
  ('benefit-2', 'Carrinho completo', 'Quantidade, cupom, subtotal, frete e total em uma única tela.', 2),
  ('benefit-3', 'Checkout objetivo', 'Formulário simples com entrega e pagamento demonstrativos.', 3),
  ('benefit-4', 'Gestão centralizada', 'Catálogo, conteúdo e pedidos disponíveis no painel.', 4)
on conflict (id) do update set title = excluded.title, text = excluded.text, order_index = excluded.order_index;

insert into public.faqs (id, question, answer, order_index) values
  ('faq-1', 'As compras são reais?', 'Não. Este projeto começa em modo demonstrativo e não processa pagamentos ou entregas reais.', 1),
  ('faq-2', 'Posso alterar os produtos?', 'Sim. O painel permite adicionar, editar, ocultar, excluir e reorganizar produtos.', 2),
  ('faq-3', 'Os banners são editáveis?', 'Sim. Textos, links, cores, imagens, posição e visibilidade são configuráveis.', 3)
on conflict (id) do update set question = excluded.question, answer = excluded.answer, order_index = excluded.order_index;

update public.store_pages
set title = case when id = 'home' then '__STORE_NAME_SQL__' else 'Sobre a __STORE_NAME_SQL__' end,
    description = case when id = 'home' then 'Página principal da loja.' else 'Conheça a proposta da loja.' end
where id in ('home', 'page-about');

update public.page_blocks
set body = 'A __STORE_NAME_SQL__ reúne catálogo, carrinho, checkout e gestão em uma experiência completa e personalizável.'
where id = 'block-about-text';

-- Depois de criar o primeiro usuário no Supabase Auth, promova-o no SQL Editor:
-- update public.profiles
-- set role = 'owner', permissions = array['dashboard','orders','catalog','store','marketing','settings','data','users']
-- where id = (select id from auth.users where email = '__ADMIN_EMAIL_SQL__');
