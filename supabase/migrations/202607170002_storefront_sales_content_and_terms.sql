-- Prepara a vitrine da Junior Imports para operação comercial.
-- O aceite dos termos é registrado no JSON `orders.customer` pela API.

update public.store_settings
set
  announcement = 'Frete grátis em compras acima de {{valor}}',
  footer_description = 'Produtos organizados por categoria, compra segura e atendimento próximo em todas as etapas do pedido.',
  free_shipping_banner_eyebrow = 'CONDIÇÃO ESPECIAL',
  free_shipping_banner_title = 'Frete grátis acima de {{valor}}.',
  free_shipping_banner_subtitle = 'Aproveite a condição e finalize seu pedido em poucos passos.',
  free_shipping_banner_button_text = 'Ver produtos',
  free_shipping_banner_button_link = '#catalogo',
  checkout_mode = 'whatsapp',
  updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id = 'default';

insert into public.banners
  (tenant_id, id, kicker, title, highlight, subtitle, button_text, button_link,
   start_color, end_color, image_url, mobile_image_url, alt_text, image_only, active, order_index)
values
  (
    '00000000-0000-4000-8000-000000000100', 'banner-1', 'BEM-VINDO À JUNIOR IMPORTS',
    'Produtos selecionados e atendimento do início ao fim.', 'atendimento do início ao fim.',
    'Explore as categorias, monte seu carrinho e finalize o pedido com acompanhamento da nossa equipe.',
    'Comprar agora', '#catalogo', '#07101f', '#0b65ef', '', '',
    'Compre na Junior Imports com atendimento humano', false, true, 1
  ),
  (
    '00000000-0000-4000-8000-000000000100', 'banner-2', 'COMPRA FÁCIL E ORGANIZADA',
    'Encontre rapidamente o produto que procura.', 'produto que procura.',
    'Todos os produtos estão separados por categoria, com preço, disponibilidade e detalhes para facilitar sua escolha.',
    'Explorar categorias', '#catalogo', '#160c25', '#765ee8', '', '',
    'Produtos da Junior Imports organizados por categoria', false, true, 2
  ),
  (
    '00000000-0000-4000-8000-000000000100', 'banner-3', 'PAGAMENTO E ENVIO',
    'Condições confirmadas com transparência.', 'com transparência.',
    'Depois do checkout, nossa equipe confirma o pagamento, os dados de envio e acompanha o seu pedido pelo WhatsApp.',
    'Como comprar', '#duvidas', '#071d19', '#128a72', '', '',
    'Pagamento e envio confirmados pelo atendimento', false, true, 3
  )
on conflict (id) do update set
  kicker = excluded.kicker,
  title = excluded.title,
  highlight = excluded.highlight,
  subtitle = excluded.subtitle,
  button_text = excluded.button_text,
  button_link = excluded.button_link,
  start_color = excluded.start_color,
  end_color = excluded.end_color,
  alt_text = excluded.alt_text,
  image_only = excluded.image_only,
  active = excluded.active,
  order_index = excluded.order_index,
  updated_at = now();

insert into public.home_sections
  (tenant_id, id, kind, name, eyebrow, title, subtitle, button_text, button_link, active, order_index)
values
  ('00000000-0000-4000-8000-000000000100', 'section-featured', 'featured', 'Produtos em destaque', 'MAIS PROCURADOS', 'Destaques da Junior Imports.', 'Uma seleção dos produtos mais procurados pelos nossos clientes.', '', '', true, 1),
  ('00000000-0000-4000-8000-000000000100', 'section-catalog', 'catalog', 'Produtos por categoria', 'COMPRE POR CATEGORIA', 'Tudo organizado para facilitar sua compra.', 'Escolha uma categoria, compare os produtos e adicione ao carrinho.', '', '', true, 2),
  ('00000000-0000-4000-8000-000000000100', 'section-promo', 'promo', 'Banner promocional', 'CONDIÇÃO ESPECIAL', 'Frete grátis acima de R$ 499.', 'Aproveite a condição e finalize seu pedido em poucos passos.', 'Ver produtos', '#catalogo', true, 3),
  ('00000000-0000-4000-8000-000000000100', 'section-benefits', 'benefits', 'Como funciona', 'COMPRA TRANSPARENTE', 'Você sabe o que acontece em cada etapa.', '', '', '', true, 4),
  ('00000000-0000-4000-8000-000000000100', 'section-faq', 'faq', 'Dúvidas frequentes', 'COMO COMPRAR', 'Tire suas dúvidas antes de finalizar.', '', '', '', true, 5)
on conflict (id) do update set
  name = excluded.name,
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  subtitle = excluded.subtitle,
  button_text = excluded.button_text,
  button_link = excluded.button_link,
  active = excluded.active,
  order_index = excluded.order_index,
  updated_at = now();

insert into public.trust_items (tenant_id, id, title, subtitle, order_index) values
  ('00000000-0000-4000-8000-000000000100', 'trust-1', 'Compra fácil', 'Produtos separados por categoria', 1),
  ('00000000-0000-4000-8000-000000000100', 'trust-2', 'Pagamento confirmado', 'Condições informadas no atendimento', 2),
  ('00000000-0000-4000-8000-000000000100', 'trust-3', 'Envio acompanhado', 'Atualizações diretamente pelo WhatsApp', 3),
  ('00000000-0000-4000-8000-000000000100', 'trust-4', 'Atendimento humano', 'Equipe disponível para tirar dúvidas', 4)
on conflict (id) do update set title = excluded.title, subtitle = excluded.subtitle, order_index = excluded.order_index;

insert into public.benefits (tenant_id, id, title, text, order_index) values
  ('00000000-0000-4000-8000-000000000100', 'benefit-1', 'Escolha os produtos', 'Navegue pelas categorias e adicione ao carrinho tudo o que deseja comprar.', 1),
  ('00000000-0000-4000-8000-000000000100', 'benefit-2', 'Revise o carrinho', 'Confira quantidades, descontos, frete e o total antes de continuar.', 2),
  ('00000000-0000-4000-8000-000000000100', 'benefit-3', 'Preencha o checkout', 'Informe seus dados, escolha o pagamento e aceite os termos da compra.', 3),
  ('00000000-0000-4000-8000-000000000100', 'benefit-4', 'Confirme no WhatsApp', 'A equipe recebe o pedido e confirma pagamento, disponibilidade e envio.', 4)
on conflict (id) do update set title = excluded.title, text = excluded.text, order_index = excluded.order_index;

insert into public.faqs (tenant_id, id, question, answer, order_index) values
  ('00000000-0000-4000-8000-000000000100', 'faq-1', 'Como faço uma compra?', 'Escolha os produtos por categoria, adicione ao carrinho, confira o resumo e preencha o checkout. Ao concluir, seu pedido será enviado para nossa equipe pelo WhatsApp.', 1),
  ('00000000-0000-4000-8000-000000000100', 'faq-2', 'Como será feito o pagamento?', 'No checkout você escolhe a forma de pagamento. Depois do envio do pedido, nossa equipe confirma pelo WhatsApp os dados, o valor final e as instruções para pagamento.', 2),
  ('00000000-0000-4000-8000-000000000100', 'faq-3', 'Quando meu pedido será enviado?', 'O envio é organizado após a confirmação do pedido e do pagamento. As informações e atualizações são repassadas diretamente pelo atendimento.', 3),
  ('00000000-0000-4000-8000-000000000100', 'faq-4', 'Como funciona a garantia?', 'É obrigatório gravar um vídeo sem cortes abrindo a encomenda, começando pela caixa ainda lacrada e mostrando os produtos. Sem esse vídeo, não há garantia, troca ou reenvio.', 4),
  ('00000000-0000-4000-8000-000000000100', 'faq-5', 'Posso tirar dúvidas antes de comprar?', 'Sim. Fale com nossa equipe pelo botão do WhatsApp disponível na loja. Teremos prazer em ajudar antes da finalização.', 5)
on conflict (id) do update set question = excluded.question, answer = excluded.answer, order_index = excluded.order_index;

update public.store_pages
set
  description = case
    when id = 'home' then 'Página principal da Junior Imports.'
    else 'Conheça a Junior Imports e nosso compromisso com uma compra transparente.'
  end,
  updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id in ('home', 'page-about');

insert into public.page_blocks
  (tenant_id, id, page_id, kind, name, eyebrow, title, body, button_text, button_link,
   image_url, background_color, text_color, container_width, padding_size, columns_count, active, order_index)
values
  (
    '00000000-0000-4000-8000-000000000100', 'block-home-institutional', 'home', 'text',
    'Mensagem institucional', 'JUNIOR IMPORTS', 'Compra clara, atendimento próximo e pedido acompanhado.',
    'Selecionamos nossos produtos com cuidado e organizamos toda a experiência para você comprar com segurança. Da escolha ao envio, nossa equipe acompanha cada etapa e mantém você informado pelo WhatsApp.',
    'Entenda como comprar', '/#duvidas', '', '#0e1117', '#f5f7fb', 'narrow', 'large', 1, true, 3
  )
on conflict (id) do update set
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  body = excluded.body,
  button_text = excluded.button_text,
  button_link = excluded.button_link,
  background_color = excluded.background_color,
  text_color = excluded.text_color,
  container_width = excluded.container_width,
  padding_size = excluded.padding_size,
  active = excluded.active,
  order_index = excluded.order_index,
  updated_at = now();

update public.page_blocks
set
  name = case
    when id = 'block-home-catalog' then 'Produtos por categoria'
    when id = 'block-home-benefits' then 'Como funciona'
    else name
  end,
  order_index = case id
    when 'block-home-featured' then 4
    when 'block-home-catalog' then 5
    when 'block-home-promo' then 6
    when 'block-home-benefits' then 7
    when 'block-home-faq' then 8
    else order_index
  end,
  updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id in ('block-home-featured', 'block-home-catalog', 'block-home-promo', 'block-home-benefits', 'block-home-faq');

update public.page_blocks
set
  eyebrow = 'NOSSA HISTÓRIA',
  title = 'Atendimento próximo em cada etapa da compra.',
  body = 'A Junior Imports nasceu para oferecer produtos selecionados com uma experiência simples, organizada e transparente. Nossa equipe acompanha o cliente desde a escolha até a confirmação do envio.',
  button_text = 'Ver produtos',
  button_link = '/#catalogo',
  updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id = 'block-about-text';

update public.page_blocks
set
  eyebrow = 'EXPLORE A LOJA',
  title = 'Encontre o produto que procura.',
  body = 'Navegue pelas categorias, monte seu carrinho e finalize o pedido com atendimento pelo WhatsApp.',
  button_text = 'Abrir catálogo',
  button_link = '/#catalogo',
  updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id = 'block-about-cta';

update public.message_automations
set
  message = case id
    when 'automation-new' then 'Olá, {{cliente}}! Recebemos o pedido {{pedido}} no valor de {{total}}. Nossa equipe fará a confirmação pelo atendimento.'
    when 'automation-paid' then 'Olá, {{cliente}}! O pagamento do pedido {{pedido}} foi confirmado.'
    when 'automation-shipped' then 'Olá, {{cliente}}! O pedido {{pedido}} foi atualizado para Enviado.'
    else message
  end,
  updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id in ('automation-new', 'automation-paid', 'automation-shipped');
