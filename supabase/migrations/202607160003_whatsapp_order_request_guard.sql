-- O checkout da Junior Imports funciona como solicitacao enviada ao WhatsApp,
-- sem cobranca online. Nesse modo, produtos ativos e nao bloqueados podem ser
-- incluidos no pedido mesmo quando a classificacao regulatoria esta pendente.
-- O modo demonstrativo direto continua com a validacao mais restritiva.

create or replace function public.enforce_sellable_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  checkout_mode text;
begin
  select *
  into product_row
  from public.products
  where id = new.product_id
    and tenant_id = new.tenant_id;

  if not found or not product_row.active then
    raise exception 'Produto indisponivel para solicitacao';
  end if;

  if product_row.regulatory_status = 'blocked' then
    raise exception 'Produto bloqueado para inclusao no pedido';
  end if;

  select settings.checkout_mode
  into checkout_mode
  from public.store_settings settings
  where settings.tenant_id = new.tenant_id
    and settings.id = 'default';

  if coalesce(checkout_mode, 'demo') = 'whatsapp' then
    return new;
  end if;

  if product_row.regulatory_status <> 'approved'
    or product_row.product_type not in ('non_medicine', 'otc')
    or (
      product_row.product_type = 'otc'
      and (
        trim(product_row.active_ingredient) = ''
        or trim(product_row.presentation) = ''
        or trim(product_row.anvisa_registration) = ''
        or trim(product_row.regulatory_warning) = ''
        or not product_row.pharmacist_reviewed
      )
    )
  then
    raise exception 'Produto indisponivel para pedido direto';
  end if;

  return new;
end;
$$;

comment on function public.enforce_sellable_order_item() is
  'Permite solicitacoes via WhatsApp para produtos ativos e nao bloqueados; mantem validacao estrita no checkout direto.';
