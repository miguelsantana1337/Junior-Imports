insert into public.store_settings (tenant_id, id, store_name, whatsapp, order_prefix, email, hours, announcement, footer_description, primary_color, free_shipping_threshold, shipping_flat, pix_discount, auto_banner_seconds, checkout_mode, whatsapp_message)
values ('00000000-0000-4000-8000-000000000100', 'default', 'Junior Imports', '5531999999999', 'JI', 'contato@juniorimports.com.br', 'Segunda a sexta · 9h às 18h', 'Frete grátis em compras acima de {{valor}}', 'Importados selecionados, ofertas exclusivas e compra rápida.', '#1677ff', 499, 29.90, 5, 6, 'whatsapp', $message$🛒 *Novo pedido – {{loja}}*

Olá! Gostaria de finalizar o seguinte pedido:

📦 *Pedido:* {{pedido}}

*Produtos:*
{{itens}}

💰 *Total do pedido:* {{total}}
💳 *Forma de pagamento:* {{pagamento}}
🎟️ *Cupom utilizado:* {{cupom}}

👤 *Cliente:* {{cliente}}

Aguardo a confirmação. Obrigado!$message$)
on conflict (tenant_id, id) do update set store_name = excluded.store_name, whatsapp = excluded.whatsapp, order_prefix = excluded.order_prefix, checkout_mode = excluded.checkout_mode, whatsapp_message = excluded.whatsapp_message;

insert into public.categories (id, name, slug, active, order_index) values
('cat-1','Tirzepatida','tirzepatida',true,1),('cat-2','Retatrutida','retatrutida',true,2),('cat-3','Peptídeos','peptideos',true,3),('cat-4','Medicamentos','medicamentos',true,4),('cat-5','Estética profissional','estetica-profissional',true,5),('cat-6','Diluentes','diluentes',true,6)
on conflict (id) do update set name=excluded.name, slug=excluded.slug, active=excluded.active, order_index=excluded.order_index;

insert into public.products (id,slug,name,category_id,brand,price,compare_at,stock,badge,accent,description,sku,rating,reviews,featured,active,order_index,image_url) values
('tg15','t-g-15','T.G. 15','cat-1','TG Labs',649.90,719.90,18,'Mais vendido','#1677ff','T.G. 15 em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-001',4.6,12,true,true,1,''),
('lipoland15','lipoland-15-mg','Lipoland 15 mg','cat-1','Lipoland',619.90,689.90,12,'Oferta','#0a73ff','Lipoland 15 mg em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-002',4.7,19,true,true,2,''),
('lipoless15','lipoless-md-15','Lipoless MD 15','cat-1','Lipoless',599.90,659.90,22,'Destaque','#2684ff','Lipoless MD 15 em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-003',4.8,26,true,true,3,''),
('tirzec15','tirzec-15','TirZec 15','cat-1','TirZec',629.90,699.90,9,'Últimas unidades','#2b6cff','TirZec 15 em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-004',4.9,33,true,true,4,''),
('slimex15','slimex-15','Slimex 15','cat-1','Slimex',579.90,639.90,28,'','#3978ff','Slimex 15 em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-005',4.6,40,true,true,5,''),
('retagen','retagen','Retagen','cat-2','Retagen',749.90,829.90,14,'Novidade','#6a58d8','Retagen em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-006',4.7,47,true,true,6,''),
('retatrutide-aq120','retatrutide-aq-120','Retatrutide AQ 120','cat-2','AQ Labs',799.90,879.90,8,'Premium','#765ee8','Retatrutide AQ 120 em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-007',4.8,54,true,true,7,''),
('peplab-retatrutide','peplab-retatrutide','PepLab Retatrutide','cat-2','PepLab',729.90,799.90,16,'','#8669ef','PepLab Retatrutide em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-008',4.9,61,true,true,8,''),
('xl-klow','xl-peptides-klow','XL Peptides KLOW','cat-3','XL Peptides',389.90,439.90,20,'Kit','#1b9688','XL Peptides KLOW em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-009',4.6,68,false,true,9,''),
('xl-glow','xl-peptides-glow','XL Peptides Glow','cat-3','XL Peptides',419.90,469.90,17,'Destaque','#d46a9e','XL Peptides Glow em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-010',4.7,75,false,true,10,''),
('ghk-cu','ghk-cu','GHK-Cu','cat-3','BioLab',299.90,349.90,31,'','#2ca0b5','GHK-Cu em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-011',4.8,82,false,true,11,''),
('mots-c','mots-c','MOTS-c','cat-3','BioLab',359.90,399.90,15,'','#a77c2f','MOTS-c em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-012',4.9,89,false,true,12,''),
('pt141','pt-141','PT-141','cat-4','Pharma Lab',279.90,319.90,19,'Oferta','#c25475','PT-141 em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-013',4.6,96,false,true,13,''),
('dysport500','dysport-500-u','Dysport 500 U','cat-5','Dysport',1249.90,1399.90,6,'Profissional','#5f72a8','Dysport 500 U em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-014',4.7,103,false,true,14,''),
('israderm','israderm','Israderm','cat-5','Israderm',459.90,519.90,11,'','#c78d68','Israderm em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-015',4.8,110,false,true,15,''),
('diluente','diluente-bacteriostatico','Diluente bacteriostático','cat-6','Junior Imports',89.90,109.90,47,'Essencial','#4e9ac7','Diluente bacteriostático em apresentação importada, selecionado para o catálogo demonstrativo da Junior Imports.','JI-016',4.9,117,false,true,16,'')
on conflict (id) do nothing;

insert into public.banners (id,kicker,title,highlight,subtitle,button_text,button_link,start_color,end_color,image_url,active,order_index) values
('banner-1','OFERTA DA SEMANA','Importados selecionados com preços especiais.','preços especiais.','Monte seu carrinho, aplique o cupom e conclua um pedido demonstrativo em poucos passos.','Comprar agora','#catalogo','#07101f','#0b65ef','',true,1),
('banner-2','NOVIDADES NO CATÁLOGO','Produtos em destaque para sua próxima compra.','próxima compra.','Conheça os lançamentos e os itens mais procurados da Junior Imports.','Ver destaques','#destaques','#160c25','#765ee8','',true,2),
('banner-3','CUPOM DE PRIMEIRA COMPRA','Use JUNIOR10 e ganhe 10% de desconto.','10% de desconto.','Condição criada para demonstrar campanhas promocionais e cupons no checkout.','Usar cupom','#catalogo','#071d19','#128a72','',true,3)
on conflict (id) do nothing;

insert into public.home_sections (id,kind,name,eyebrow,title,subtitle,button_text,button_link,active,order_index) values
('section-featured','featured','Produtos em destaque','DESTAQUES DA LOJA','Os produtos mais procurados.','Seleção configurável pelo painel.','','',true,1),
('section-catalog','catalog','Catálogo completo','TODOS OS PRODUTOS','Encontre o produto certo.','Busque, filtre e ordene o catálogo.','','',true,2),
('section-promo','promo','Banner promocional','CONDIÇÃO ESPECIAL','Frete grátis acima de R$ 499.','Aproveite as condições demonstrativas e finalize seu pedido em poucos passos.','Ver produtos','#catalogo',true,3),
('section-benefits','benefits','Benefícios','POR QUE COMPRAR','Uma experiência pensada para conversão.','','','',true,4),
('section-faq','faq','Dúvidas frequentes','PRECISA DE AJUDA?','Informação clara antes da compra.','','','',true,5)
on conflict (id) do nothing;

insert into public.coupons (id,code,discount_type,value,minimum,active) values ('coupon-1','JUNIOR10','percent',10,0,true),('coupon-2','PRIMEIRA25','fixed',25,250,true) on conflict (id) do nothing;
insert into public.trust_items (id,title,subtitle,order_index) values ('trust-1','Compra rápida','Checkout em poucos passos',1),('trust-2','Pagamento simulado','Pix, cartão ou boleto',2),('trust-3','Frete demonstrativo','Grátis acima de R$ 499',3),('trust-4','Suporte direto','Atendimento por WhatsApp',4) on conflict (id) do nothing;
insert into public.benefits (id,title,text,order_index) values ('benefit-1','Ofertas visíveis','Preço, desconto e condições apresentados diretamente no produto.',1),('benefit-2','Carrinho completo','Quantidade, cupom, subtotal, frete e total em uma única tela.',2),('benefit-3','Checkout objetivo','Formulário simples com entrega e pagamento demonstrativos.',3),('benefit-4','Pedido registrado','Cada simulação gera um código e fica disponível no painel.',4) on conflict (id) do nothing;
insert into public.faqs (id,question,answer,order_index) values ('faq-1','As compras são reais?','Não. Este é um projeto demonstrativo. Nenhum pagamento, envio ou venda real é processado.',1),('faq-2','Como funciona o checkout?','O sistema calcula cupom, frete e condição de pagamento, registra um pedido de teste e exibe um código demonstrativo.',2),('faq-3','Posso alterar os produtos?','Sim. O painel permite adicionar, editar, ocultar, excluir e reorganizar produtos.',3),('faq-4','Os banners são editáveis?','Sim. É possível alterar texto, link, cores, imagem, posição e visibilidade dos banners rotativos.',4) on conflict (id) do nothing;

-- Depois de criar o primeiro usuario no Supabase Auth, promova-o manualmente:
-- update public.profiles set role = 'admin' where id = '<UUID_DO_USUARIO>';
