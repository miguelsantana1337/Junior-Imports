-- Garante que a vitrine permaneça pronta para vendas e preserve o WhatsApp
-- escolhido pelo administrador como destino oficial do checkout.

update public.store_settings
set
  checkout_mode = 'whatsapp',
  footer_description = coalesce(nullif(footer_description, ''), 'Produtos organizados por categoria, compra segura e atendimento próximo em todas as etapas do pedido.'),
  updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id = 'default';

insert into public.home_sections
  (tenant_id, id, kind, name, eyebrow, title, subtitle, button_text, button_link, active, order_index)
values
  ('00000000-0000-4000-8000-000000000100', 'section-faq', 'faq', 'Como comprar',
   'PERGUNTAS FREQUENTES', 'Como comprar na Junior Imports.',
   'Escolha os produtos, finalize o checkout e continue o atendimento no WhatsApp.',
   '', '', true, 5)
on conflict (id) do update set
  name = excluded.name,
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  subtitle = excluded.subtitle,
  active = excluded.active,
  order_index = excluded.order_index,
  updated_at = now();

insert into public.page_blocks
  (tenant_id, id, page_id, kind, name, eyebrow, title, body, button_text, button_link,
   image_url, background_color, text_color, container_width, padding_size, columns_count, active, order_index)
values
  ('00000000-0000-4000-8000-000000000100', 'block-home-faq', 'home', 'faq', 'Como comprar',
   'PERGUNTAS FREQUENTES', 'Como comprar na Junior Imports.', '', '', '', '', '', '',
   'normal', 'large', 1, true, 8)
on conflict (id) do update set
  name = excluded.name,
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  active = excluded.active,
  order_index = excluded.order_index,
  updated_at = now();

insert into public.faqs (tenant_id, id, question, answer, order_index) values
  ('00000000-0000-4000-8000-000000000100', 'faq-1', 'Como faço uma compra?', 'Escolha os produtos, adicione ao carrinho e preencha o checkout. Ao finalizar, o pedido será registrado e o WhatsApp oficial da loja abrirá com todos os dados para a equipe continuar o atendimento.', 1),
  ('00000000-0000-4000-8000-000000000100', 'faq-2', 'Como será feito o pagamento?', 'No checkout você informa a forma de pagamento preferida. A equipe confirma pelo WhatsApp os dados, o valor final e as instruções para pagamento.', 2),
  ('00000000-0000-4000-8000-000000000100', 'faq-3', 'Quando meu pedido será enviado?', 'O envio é organizado depois da confirmação do pedido e do pagamento. As atualizações são repassadas diretamente pelo atendimento no WhatsApp.', 3),
  ('00000000-0000-4000-8000-000000000100', 'faq-4', 'Como funciona a garantia?', 'É obrigatório gravar um vídeo sem cortes abrindo a encomenda, começando pela caixa ainda lacrada e mostrando os produtos. Sem esse vídeo, não há garantia, troca ou reenvio.', 4),
  ('00000000-0000-4000-8000-000000000100', 'faq-5', 'Posso tirar dúvidas antes de comprar?', 'Sim. Use o botão do WhatsApp da loja para falar com a equipe antes de finalizar o pedido.', 5)
on conflict (id) do update set
  question = excluded.question,
  answer = excluded.answer,
  order_index = excluded.order_index;

-- O campo store_settings.whatsapp não é sobrescrito aqui de propósito:
-- o número definido no painel administrativo continua sendo a fonte do checkout.
