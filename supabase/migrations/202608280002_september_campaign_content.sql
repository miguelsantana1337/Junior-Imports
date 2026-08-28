begin;

update public.store_settings settings set
  promotion_gift_message = '',
  promotion_price_match_message = '',
  free_shipping_banner_eyebrow = 'SETEMBRO ESPECIAL',
  free_shipping_banner_title = 'Condições exclusivas em TG 15 mg.',
  free_shipping_banner_subtitle = 'Dose extra de 2,5 mg, terceira ampola com 50% OFF e caixa com ampola grátis.',
  free_shipping_banner_button_text = 'Ver TG 15 mg',
  free_shipping_banner_button_link = '#catalogo',
  updated_at = now()
where exists (
  select 1 from public.products product
  where product.tenant_id = settings.tenant_id
    and product.id = 'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc'
);

update public.home_sections section set
  eyebrow = 'SETEMBRO ESPECIAL',
  title = 'Condições exclusivas em TG 15 mg.',
  subtitle = 'Dose extra de 2,5 mg, terceira ampola com 50% OFF e caixa com ampola grátis.',
  button_text = 'Ver TG 15 mg',
  button_link = '#catalogo',
  updated_at = now()
where section.kind = 'promo'
  and exists (
    select 1 from public.products product
    where product.tenant_id = section.tenant_id
      and product.id = 'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc'
  );

update public.page_blocks block set
  eyebrow = 'SETEMBRO ESPECIAL',
  title = 'Condições exclusivas em TG 15 mg.',
  body = E'1 ampola: ganhe 1 dose extra de 2,5 mg na seringa.\nA cada 3 ampolas: uma recebe 50% OFF.\n1 caixa: ganhe 1 ampola do mesmo produto.\nPromoção + cashback, sem cupom ou desconto adicional.',
  button_text = 'Ver TG 15 mg',
  button_link = '#catalogo',
  updated_at = now()
where block.kind = 'promo'
  and block.page_id = 'home'
  and exists (
    select 1 from public.products product
    where product.tenant_id = block.tenant_id
      and product.id = 'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc'
  );

commit;
