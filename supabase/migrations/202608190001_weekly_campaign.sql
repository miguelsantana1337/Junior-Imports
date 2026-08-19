begin;

-- Regras comerciais temporárias editáveis pelo painel.
alter table public.store_settings
  add column if not exists promotion_enabled boolean not null default false,
  add column if not exists promotion_name text not null default 'Campanha da semana',
  add column if not exists promotion_starts_at timestamptz,
  add column if not exists promotion_ends_at timestamptz,
  add column if not exists promotion_highlights jsonb not null default '[]'::jsonb,
  add column if not exists promotion_gift_message text not null default '',
  add column if not exists promotion_price_match_message text not null default '',
  add column if not exists pix_discount_minimum numeric(12,2) not null default 0,
  add column if not exists card_installments integer not null default 2,
  add column if not exists card_installment_minimum numeric(12,2) not null default 0,
  add column if not exists loyalty_discount_enabled boolean not null default false,
  add column if not exists loyalty_order_interval integer not null default 6,
  add column if not exists loyalty_discount_amount numeric(12,2) not null default 0;

alter table public.store_settings
  drop constraint if exists store_settings_promotion_window_check,
  drop constraint if exists store_settings_promotion_highlights_check,
  drop constraint if exists store_settings_campaign_values_check;
alter table public.store_settings
  add constraint store_settings_promotion_window_check
    check (promotion_ends_at is null or promotion_starts_at is null or promotion_ends_at > promotion_starts_at),
  add constraint store_settings_promotion_highlights_check
    check (jsonb_typeof(promotion_highlights) = 'array'),
  add constraint store_settings_campaign_values_check
    check (
      pix_discount_minimum >= 0
      and card_installments between 1 and 12
      and card_installment_minimum >= 0
      and loyalty_order_interval between 2 and 100
      and loyalty_discount_amount >= 0
    );

alter table public.orders
  add column if not exists loyalty_discount numeric(12,2) not null default 0,
  add column if not exists campaign_gift text not null default '';
alter table public.orders
  drop constraint if exists orders_loyalty_discount_check,
  drop constraint if exists orders_campaign_gift_length_check;
alter table public.orders
  add constraint orders_loyalty_discount_check check (loyalty_discount >= 0 and loyalty_discount <= subtotal),
  add constraint orders_campaign_gift_length_check check (char_length(campaign_gift) <= 180);

create table if not exists public.loyalty_reward_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete restrict,
  order_id text not null,
  reward_cycle integer not null check (reward_cycle > 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'redeemed', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_reward_reservations_order_fk
    foreign key (order_id) references public.orders(id) on delete restrict deferrable initially deferred
);
create unique index if not exists loyalty_reward_reservations_active_cycle
  on public.loyalty_reward_reservations (tenant_id, customer_id, reward_cycle)
  where status in ('reserved', 'redeemed');
create unique index if not exists loyalty_reward_reservations_order
  on public.loyalty_reward_reservations (tenant_id, order_id);

alter table public.loyalty_reward_reservations enable row level security;
drop policy if exists "tenant loyalty rewards read" on public.loyalty_reward_reservations;
create policy "tenant loyalty rewards read" on public.loyalty_reward_reservations
for select to authenticated
using (public.has_tenant_permission(tenant_id, 'orders') or public.has_tenant_permission(tenant_id, 'marketing'));
revoke all on table public.loyalty_reward_reservations from anon, authenticated;
grant select on table public.loyalty_reward_reservations to authenticated;

-- O mesmo cálculo do navegador é repetido no banco; após o fim da campanha,
-- a condição de frete deixa de ser aplicada automaticamente.
create or replace function public.calculate_storefront_shipping(
  p_tenant_id uuid,
  p_customer jsonb,
  p_after_discounts numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.store_settings%rowtype;
  v_delivery_method text := lower(trim(coalesce(p_customer->>'deliveryMethod', 'delivery')));
  v_city text := public.normalize_shipping_city(p_customer->>'city');
  v_state text := upper(trim(coalesce(p_customer->>'state', '')));
  v_promotion_rule_active boolean;
  v_rate jsonb;
  v_rate_city text;
  v_rate_state text;
  v_rate_amount numeric(12,2);
begin
  select * into v_settings from public.store_settings
  where tenant_id = p_tenant_id and id = 'default';
  if not found then raise exception 'Configuração da loja não encontrada'; end if;

  if v_delivery_method = 'pickup' then
    if not v_settings.local_pickup_enabled then raise exception 'Retirada no local indisponível'; end if;
    return jsonb_build_object('amount', 0, 'status', 'pickup');
  end if;
  if v_delivery_method <> 'delivery' then raise exception 'Forma de recebimento inválida'; end if;

  v_promotion_rule_active := not v_settings.promotion_enabled or (
    (v_settings.promotion_starts_at is null or v_settings.promotion_starts_at <= now())
    and (v_settings.promotion_ends_at is null or v_settings.promotion_ends_at >= now())
  );
  if v_settings.free_shipping_enabled and v_promotion_rule_active
    and p_after_discounts >= v_settings.free_shipping_threshold
  then
    return jsonb_build_object('amount', 0, 'status', 'free');
  end if;

  if jsonb_array_length(coalesce(v_settings.shipping_city_rates, '[]'::jsonb)) > 0 and v_city = '' then
    return jsonb_build_object('amount', 0, 'status', 'pending');
  end if;
  for v_rate in select value from jsonb_array_elements(coalesce(v_settings.shipping_city_rates, '[]'::jsonb)) loop
    v_rate_city := public.normalize_shipping_city(v_rate->>'city');
    v_rate_state := upper(trim(coalesce(v_rate->>'state', '')));
    if v_rate_city = v_city and (v_rate_state = '' or v_rate_state = v_state) then
      begin
        v_rate_amount := greatest(0, coalesce((v_rate->>'amount')::numeric, 0));
      exception when invalid_text_representation then
        v_rate_amount := 0;
      end;
      return jsonb_build_object('amount', v_rate_amount, 'status', 'calculated');
    end if;
  end loop;
  if jsonb_array_length(coalesce(v_settings.shipping_city_rates, '[]'::jsonb)) > 0
    and v_settings.quote_shipping_outside_cities
  then
    return jsonb_build_object('amount', 0, 'status', 'quote');
  end if;
  return jsonb_build_object('amount', greatest(0, coalesce(v_settings.shipping_flat, 0)), 'status', 'calculated');
end;
$$;

-- Adiciona o pedido mínimo do Pix à função segura sem trocar sua assinatura.
do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.create_tenant_order_secure(uuid,jsonb,jsonb,text,text,uuid,text,text,text,integer)'::regprocedure
  ) into current_definition;

  if position('pix_discount_minimum' in current_definition) = 0 then
    updated_definition := replace(
      current_definition,
      'if p_payment = ''Pix'' then' || chr(10) ||
      '    v_payment_discount := (v_subtotal - v_coupon_discount) * v_settings.pix_discount / 100;' || chr(10) ||
      '  end if;',
      'if p_payment = ''Pix''' || chr(10) ||
      '    and (v_subtotal - v_coupon_discount) >= v_settings.pix_discount_minimum' || chr(10) ||
      '    and (not v_settings.promotion_enabled or (' || chr(10) ||
      '      (v_settings.promotion_starts_at is null or v_settings.promotion_starts_at <= now())' || chr(10) ||
      '      and (v_settings.promotion_ends_at is null or v_settings.promotion_ends_at >= now())' || chr(10) ||
      '    ))' || chr(10) ||
      '  then' || chr(10) ||
      '    v_payment_discount := (v_subtotal - v_coupon_discount) * v_settings.pix_discount / 100;' || chr(10) ||
      '  end if;'
    );
    if updated_definition = current_definition or position('pix_discount_minimum' in updated_definition) = 0 then
      raise exception 'Não foi possível incluir o pedido mínimo do Pix no checkout seguro';
    end if;
    execute updated_definition;
  end if;
end;
$$;

-- Reserva uma única recompensa por ciclo (6ª, 12ª, 18ª...) antes de o total
-- financeiro ser inicializado. Cancelar o pedido libera o mesmo ciclo.
create or replace function public.apply_order_campaign_benefits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.store_settings%rowtype;
  v_active boolean := false;
  v_previous_paid integer := 0;
  v_reward_cycle integer := 0;
  v_inserted integer := 0;
  v_merchandise numeric(12,2) := 0;
  v_loyalty numeric(12,2) := 0;
  v_shipping_quote jsonb;
begin
  if coalesce(new.order_source, 'legacy') <> 'storefront' then return new; end if;
  select * into v_settings from public.store_settings
  where tenant_id = new.tenant_id and id = 'default';
  if not found then return new; end if;

  v_active := v_settings.promotion_enabled
    and (v_settings.promotion_starts_at is null or v_settings.promotion_starts_at <= new.created_at)
    and (v_settings.promotion_ends_at is null or v_settings.promotion_ends_at >= new.created_at);
  if not v_active then return new; end if;

  new.campaign_gift := left(trim(v_settings.promotion_gift_message), 180);
  if not v_settings.loyalty_discount_enabled or v_settings.loyalty_discount_amount <= 0
    or coalesce(new.customer_id, '') = ''
  then
    return new;
  end if;

  select count(*) into v_previous_paid
  from public.orders previous
  where previous.tenant_id = new.tenant_id
    and previous.customer_id = new.customer_id
    and previous.status <> 'Cancelado'
    and (previous.payment_status = 'Recebido' or previous.status in ('Pago', 'Entregue'));

  if mod(v_previous_paid + 1, v_settings.loyalty_order_interval) <> 0 then return new; end if;
  v_reward_cycle := (v_previous_paid + 1) / v_settings.loyalty_order_interval;

  insert into public.loyalty_reward_reservations
    (tenant_id, customer_id, order_id, reward_cycle, amount, status)
  values
    (new.tenant_id, new.customer_id, new.id, v_reward_cycle, 0, 'reserved')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return new; end if;

  v_merchandise := greatest(0, new.total - new.shipping);
  v_loyalty := round(least(v_settings.loyalty_discount_amount, v_merchandise), 2);
  new.loyalty_discount := v_loyalty;
  new.discount := round(new.discount + v_loyalty, 2);
  v_merchandise := greatest(0, v_merchandise - v_loyalty);
  v_shipping_quote := public.calculate_storefront_shipping(new.tenant_id, new.customer, v_merchandise);
  new.shipping := coalesce((v_shipping_quote->>'amount')::numeric, 0);
  new.shipping_status := coalesce(v_shipping_quote->>'status', 'calculated');
  new.total := round(v_merchandise + new.shipping, 2);

  update public.loyalty_reward_reservations
  set amount = v_loyalty, updated_at = now()
  where tenant_id = new.tenant_id and order_id = new.id;
  return new;
end;
$$;

drop trigger if exists apply_order_campaign_benefits on public.orders;
create trigger apply_order_campaign_benefits
before insert on public.orders
for each row execute function public.apply_order_campaign_benefits();

create or replace function public.sync_loyalty_reward_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Cancelado' and old.status is distinct from 'Cancelado' then
    update public.loyalty_reward_reservations set status = 'released', updated_at = now()
    where tenant_id = new.tenant_id and order_id = new.id and status = 'reserved';
  elsif new.payment_status = 'Recebido' and old.payment_status is distinct from 'Recebido' then
    update public.loyalty_reward_reservations set status = 'redeemed', updated_at = now()
    where tenant_id = new.tenant_id and order_id = new.id and status = 'reserved';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_loyalty_reward_reservation on public.orders;
create trigger sync_loyalty_reward_reservation
after update of payment_status, status on public.orders
for each row execute function public.sync_loyalty_reward_reservation();

-- Configuração preparada para a semana de 19 a 23 de agosto de 2026.
-- `now()` é estável durante toda a transação e funciona como o corte único da
-- campanha: nenhum pedido criado antes desta migração recebe as novas regras.
update public.store_settings settings
set
  promotion_enabled = true,
  promotion_name = 'Semana de Benefícios Junior Imports',
  promotion_starts_at = now(),
  promotion_ends_at = '2026-08-23 23:59:59-03'::timestamptz,
  promotion_highlights = jsonb_build_array(
    '5% de cashback em toda a loja',
    'Frete grátis acima de R$ 500',
    '5% OFF no Pix acima de R$ 900',
    'Coqueteleira + brindes nos pedidos',
    'R$ 150 OFF na 6ª compra',
    'Indicou? Ganhe 10% de cashback da compra da sua indicação',
    'Cobrimos qualquer valor da região!',
    '2x sem juros para compras acima de R$ 950'
  ),
  promotion_gift_message = 'Coqueteleira + brindes nos pedidos',
  promotion_price_match_message = 'Cobrimos qualquer valor da região!',
  free_shipping_enabled = true,
  free_shipping_threshold = 500,
  pix_discount = 5,
  pix_discount_minimum = 900,
  card_installments = 2,
  card_installment_minimum = 950,
  loyalty_discount_enabled = true,
  loyalty_order_interval = 6,
  loyalty_discount_amount = 150,
  announcement = '5% de cashback · Frete grátis acima de R$ 500 · 5% OFF no Pix acima de R$ 900',
  free_shipping_banner_enabled = true,
  free_shipping_banner_eyebrow = 'SEMANA DE BENEFÍCIOS',
  free_shipping_banner_title = 'Frete grátis acima de R$ 500.',
  free_shipping_banner_subtitle = 'Aproveite cashback, Pix, brindes e condições especiais por tempo limitado.',
  updated_at = now()
where settings.id = 'default'
  and settings.tenant_id in (select id from public.tenants where slug = 'junior-imports');

update public.page_blocks block
set eyebrow = 'SEMANA DE BENEFÍCIOS',
    title = 'Condições especiais em toda a loja.',
    body = 'Cashback, frete grátis, desconto no Pix, brindes e recompensa de fidelidade por tempo limitado.',
    button_text = 'Ver produtos',
    button_link = '#catalogo',
    active = true,
    updated_at = now()
where block.kind = 'promo' and block.page_id = 'home'
  and block.tenant_id in (select id from public.tenants where slug = 'junior-imports');

with placeholders as (
  select banner.tenant_id, banner.id,
    row_number() over (partition by banner.tenant_id order by banner.order_index, banner.id) as position
  from public.banners banner
  where banner.tenant_id in (select id from public.tenants where slug = 'junior-imports')
    and (banner.title = 'Título claro para a campanha.' or banner.kicker = 'NOVA CAMPANHA')
)
update public.banners banner
set kicker = case when placeholders.position = 1 then 'SEMANA DE BENEFÍCIOS' else banner.kicker end,
    title = case when placeholders.position = 1 then 'Mais vantagens para comprar nesta semana.' else banner.title end,
    highlight = case when placeholders.position = 1 then 'vantagens para comprar' else banner.highlight end,
    subtitle = case when placeholders.position = 1 then '5% de cashback, frete grátis, desconto no Pix e brindes por tempo limitado.' else banner.subtitle end,
    button_text = case when placeholders.position = 1 then 'Comprar agora' else banner.button_text end,
    button_link = case when placeholders.position = 1 then '#catalogo' else banner.button_link end,
    active = placeholders.position = 1,
    updated_at = now()
from placeholders
where banner.tenant_id = placeholders.tenant_id and banner.id = placeholders.id;

-- A campanha de cashback nasce como rascunho: o Guardião financeiro precisa
-- simular margem e autorizar a ativação com um usuário do painel.
insert into public.cashback_campaigns (
  tenant_id, id, name, description, status, starts_at, ends_at, multiplier,
  fixed_bonus, credit_valid_days, priority, target_segments, product_ids,
  category_ids, coupon_mode, minimum_margin_percent, calculation_version
)
select tenant.id, 'cashback-week-2026-08-19', 'Cashback 5% em toda a loja',
  'Campanha semanal sobre o valor pago pelos produtos, após descontos e sem frete.',
  'draft', now(), '2026-08-23 23:59:59-03'::timestamptz,
  5, 0, 90, 200, '{}', '{}', '{}', 'compatible', 0, 'commerce-v2'
from public.tenants tenant where tenant.slug = 'junior-imports'
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  multiplier = excluded.multiplier,
  fixed_bonus = excluded.fixed_bonus,
  priority = excluded.priority,
  target_segments = excluded.target_segments,
  product_ids = excluded.product_ids,
  category_ids = excluded.category_ids,
  coupon_mode = excluded.coupon_mode,
  calculation_version = excluded.calculation_version,
  updated_at = now();

-- O vínculo usa a data de criação do pedido, não o instante em que a rotina é
-- chamada. Isso impede que um pedido antigo seja anexado retroativamente à nova
-- campanha.
create or replace function public.attach_referral_to_order(
  p_tenant_id uuid,
  p_order_id text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_code public.referral_codes%rowtype;
  v_campaign public.referral_campaigns%rowtype;
  v_link_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  if trim(coalesce(p_code, '')) = '' then return jsonb_build_object('attached', false); end if;

  select * into v_order from public.orders
  where tenant_id = p_tenant_id and id = p_order_id for update;
  if not found or coalesce(v_order.customer_id, '') = '' then
    raise exception 'Pedido ou cliente não encontrado';
  end if;

  select * into v_code from public.referral_codes
  where tenant_id = p_tenant_id
    and upper(code) = upper(trim(p_code))
    and status = 'active'
    and (expires_at is null or expires_at > now());
  if not found then raise exception 'Código de indicação inválido ou expirado'; end if;
  if v_code.customer_id = v_order.customer_id then raise exception 'Autoindicação não é permitida'; end if;
  if exists (
    select 1 from public.referral_links circular
    where circular.tenant_id = p_tenant_id
      and circular.referrer_customer_id = v_order.customer_id
      and circular.referred_customer_id = v_code.customer_id
  ) then raise exception 'Vínculo circular de indicação não é permitido'; end if;

  if exists (
    select 1 from public.orders previous
    where previous.tenant_id = p_tenant_id
      and previous.customer_id = v_order.customer_id
      and previous.id <> v_order.id
      and previous.status <> 'Cancelado'
  ) then raise exception 'A indicação é válida somente para a primeira compra do cliente'; end if;

  select * into v_campaign from public.referral_campaigns
  where tenant_id = p_tenant_id and status = 'active'
    and starts_at <= v_order.created_at
    and (ends_at is null or ends_at >= v_order.created_at)
    and greatest(0, coalesce(v_order.financial_total, v_order.total) - v_order.shipping) >= minimum_order_amount
  order by starts_at desc limit 1;
  if not found then raise exception 'Não há campanha de indicação ativa para este pedido'; end if;

  insert into public.referral_links (
    tenant_id, campaign_id, referral_code_id, referrer_customer_id,
    referred_customer_id, order_id, status, source
  ) values (
    p_tenant_id, v_campaign.id, v_code.id, v_code.customer_id,
    v_order.customer_id, v_order.id, 'tracked', 'checkout'
  )
  on conflict (tenant_id, order_id) do update set updated_at = now()
  returning id into v_link_id;

  insert into public.referral_rewards (
    tenant_id, referral_link_id, order_id, beneficiary_customer_id,
    reward_type, reward_value, status
  ) values (
    p_tenant_id, v_link_id, v_order.id, v_code.customer_id,
    v_campaign.reward_type, v_campaign.reward_value, 'predicted'
  ) on conflict (tenant_id, referral_link_id) do nothing;

  update public.orders set referral_code = upper(trim(p_code))
  where tenant_id = p_tenant_id and id = p_order_id;

  return jsonb_build_object('attached', true, 'referral_link_id', v_link_id);
end;
$$;

-- A recompensa usa o tipo e o percentual congelados em referral_rewards no
-- momento da compra. Editar ou encerrar a campanha nunca recalcula pedidos já
-- existentes.
create or replace function public.sync_referral_reward_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.referral_links%rowtype;
  v_campaign public.referral_campaigns%rowtype;
  v_reward public.referral_rewards%rowtype;
  v_base numeric(12,2);
  v_amount numeric(12,2);
  v_entry_id uuid;
  v_reversal_id uuid;
  v_month_count integer;
  v_total_count integer;
begin
  select * into v_link from public.referral_links
  where tenant_id = new.tenant_id and order_id = new.id;
  if not found then return new; end if;

  select * into v_campaign from public.referral_campaigns where id = v_link.campaign_id;
  select * into v_reward from public.referral_rewards
  where tenant_id = new.tenant_id and referral_link_id = v_link.id for update;

  if new.payment_status = 'Recebido' and old.payment_status is distinct from 'Recebido'
    and v_reward.status = 'predicted'
  then
    select count(*) into v_total_count from public.referral_rewards
    where tenant_id = new.tenant_id and beneficiary_customer_id = v_link.referrer_customer_id and status = 'available';
    select count(*) into v_month_count from public.referral_rewards
    where tenant_id = new.tenant_id and beneficiary_customer_id = v_link.referrer_customer_id
      and status = 'available' and available_at >= date_trunc('month', now());

    if (v_campaign.max_rewards_per_referrer > 0 and v_total_count >= v_campaign.max_rewards_per_referrer)
      or (v_campaign.max_rewards_per_month > 0 and v_month_count >= v_campaign.max_rewards_per_month)
    then
      update public.referral_links set status = 'blocked', block_reason = 'Limite da campanha atingido', updated_at = now() where id = v_link.id;
      update public.referral_rewards set status = 'blocked', updated_at = now() where id = v_reward.id;
      return new;
    end if;

    v_base := round(greatest(0, coalesce(new.financial_total, new.total) - new.shipping), 2);
    v_amount := case when v_reward.reward_type = 'percent'
      then round(v_base * v_reward.reward_value / 100, 2)
      else round(v_reward.reward_value, 2) end;
    if v_campaign.reward_cap > 0 then v_amount := least(v_amount, v_campaign.reward_cap); end if;

    if v_amount > 0 then
      insert into public.cashback_entries (
        tenant_id, customer_id, kind, amount, description, order_id,
        operation_id, expires_at, metadata
      ) values (
        new.tenant_id, v_link.referrer_customer_id, 'adjustment_credit', v_amount,
        'Bônus por indicação confirmada no pedido ' || new.code, new.id,
        gen_random_uuid(), now() + make_interval(days => v_campaign.credit_valid_days),
        jsonb_build_object('referral_link_id', v_link.id, 'eligible_base', v_base, 'campaign_id', v_campaign.id)
      ) returning id into v_entry_id;

      update public.referral_rewards set eligible_base = v_base, reward_amount = v_amount,
        status = 'available', cashback_entry_id = v_entry_id, available_at = now(), updated_at = now()
      where id = v_reward.id;
      update public.referral_links set status = 'rewarded', updated_at = now() where id = v_link.id;
    end if;
  end if;

  if new.status = 'Cancelado' and old.status is distinct from 'Cancelado'
    and v_reward.status = 'available' and v_reward.cashback_entry_id is not null
  then
    insert into public.cashback_entries (
      tenant_id, customer_id, kind, amount, description, order_id,
      reference_entry_id, operation_id, metadata
    ) values (
      new.tenant_id, v_link.referrer_customer_id, 'order_reversal', v_reward.reward_amount,
      'Reversão do bônus de indicação do pedido ' || new.code, new.id,
      v_reward.cashback_entry_id, gen_random_uuid(), jsonb_build_object('referral_link_id', v_link.id)
    ) on conflict do nothing returning id into v_reversal_id;

    update public.referral_rewards set status = 'reversed', reversal_entry_id = v_reversal_id,
      reversed_at = now(), updated_at = now() where id = v_reward.id;
    update public.referral_links set status = 'reversed', updated_at = now() where id = v_link.id;
  end if;
  return new;
end;
$$;

-- O indicador recebe 10% do valor confirmado dos produtos, sem frete e sem teto.
do $$
declare
  v_tenant uuid;
  v_new_campaign constant uuid := '20260819-0000-4000-8000-000000000010'::uuid;
begin
  select id into v_tenant from public.tenants where slug = 'junior-imports' limit 1;
  if v_tenant is null then return; end if;

  update public.referral_campaigns
  set status = 'ended', ends_at = greatest(now(), starts_at + interval '1 second'), updated_at = now()
  where tenant_id = v_tenant and status = 'active' and id <> v_new_campaign;

  insert into public.referral_campaigns (
    id, tenant_id, name, status, starts_at, ends_at, reward_type, reward_value,
    reward_cap, credit_valid_days, minimum_order_amount
  ) values (
    v_new_campaign, v_tenant, 'Indique e ganhe 10%', 'active', now(),
    '2026-08-23 23:59:59-03'::timestamptz, 'percent', 10, 0, 90, 0
  )
  on conflict (id) do update set
    name = excluded.name, status = excluded.status, starts_at = excluded.starts_at,
    ends_at = excluded.ends_at, reward_type = excluded.reward_type,
    reward_value = excluded.reward_value, reward_cap = excluded.reward_cap,
    credit_valid_days = excluded.credit_valid_days,
    minimum_order_amount = excluded.minimum_order_amount, updated_at = now();
end;
$$;

revoke all on function public.apply_order_campaign_benefits() from public, anon, authenticated;
revoke all on function public.sync_loyalty_reward_reservation() from public, anon, authenticated;
revoke all on function public.attach_referral_to_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.attach_referral_to_order(uuid, text, text) to service_role;
grant execute on function public.calculate_storefront_shipping(uuid, jsonb, numeric) to service_role;

commit;
