-- Lote 4: calendário editorial, workflow de publicação e automações rastreáveis.

create table if not exists public.marketing_publications (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text not null default '',
  kind text not null check (kind in ('campaign', 'banner', 'coupon', 'cashback', 'message')),
  entity_id text not null default '',
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'scheduled', 'published', 'paused', 'archived')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  owner_email text not null default '',
  reviewer_email text not null default '',
  revision integer not null default 1 check (revision > 0),
  notes text not null default '',
  last_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_publications_window check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.marketing_publication_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  publication_id text not null references public.marketing_publications(id) on delete cascade,
  revision integer not null check (revision > 0),
  status text not null check (status in ('draft', 'in_review', 'approved', 'scheduled', 'published', 'paused', 'archived')),
  snapshot jsonb not null,
  note text not null default '',
  actor_email text not null default '',
  created_at timestamptz not null default now(),
  unique (publication_id, revision)
);

alter table public.message_automations
  add column if not exists trigger_type text not null default 'order_status',
  add column if not exists trigger_value text not null default '',
  add column if not exists conditions jsonb not null default '{"minOrderTotal":0,"orderSource":"any","customerSegment":"all"}'::jsonb,
  add column if not exists actions jsonb not null default '{"sendMessage":true,"createTask":false,"taskTitle":"","addTag":""}'::jsonb,
  add column if not exists workflow_status text not null default 'active',
  add column if not exists max_retries integer not null default 3,
  add column if not exists retry_delay_minutes integer not null default 15,
  add column if not exists last_tested_at timestamptz,
  add column if not exists run_count integer not null default 0,
  add column if not exists failure_count integer not null default 0;

update public.message_automations
set trigger_value = trigger_status
where trigger_value = '';

do $$ begin
  alter table public.message_automations add constraint message_automations_trigger_type_check
    check (trigger_type in ('order_status', 'customer_segment', 'cashback_expiring', 'schedule'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.message_automations add constraint message_automations_workflow_status_check
    check (workflow_status in ('draft', 'active', 'paused'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.message_automations add constraint message_automations_retry_check
    check (max_retries between 0 and 10 and retry_delay_minutes between 1 and 10080);
exception when duplicate_object then null; end $$;

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  automation_id text references public.message_automations(id) on delete set null,
  automation_name text not null,
  trigger_type text not null check (trigger_type in ('order_status', 'customer_segment', 'cashback_expiring', 'schedule')),
  trigger_event jsonb not null default '{}'::jsonb,
  status text not null check (status in ('testing', 'simulated', 'queued', 'running', 'succeeded', 'failed', 'retrying', 'cancelled')),
  attempt integer not null default 1 check (attempt > 0),
  max_attempts integer not null default 1 check (max_attempts > 0),
  output jsonb not null default '{}'::jsonb,
  error_message text not null default '',
  next_retry_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

alter table public.message_logs
  add column if not exists run_id uuid references public.automation_runs(id) on delete set null,
  add column if not exists attempt integer not null default 1,
  add column if not exists error_message text not null default '';

create index if not exists marketing_publications_tenant_calendar on public.marketing_publications (tenant_id, starts_at, ends_at);
create index if not exists marketing_publications_tenant_status on public.marketing_publications (tenant_id, status, updated_at desc);
create index if not exists marketing_publication_versions_history on public.marketing_publication_versions (tenant_id, publication_id, revision desc);
create index if not exists automation_runs_tenant_created on public.automation_runs (tenant_id, created_at desc);
create index if not exists automation_runs_retry on public.automation_runs (tenant_id, status, next_retry_at) where status in ('failed', 'retrying');

alter table public.marketing_publications enable row level security;
alter table public.marketing_publication_versions enable row level security;
alter table public.automation_runs enable row level security;

drop policy if exists "tenant marketing publications read" on public.marketing_publications;
create policy "tenant marketing publications read" on public.marketing_publications for select to authenticated
using (public.has_tenant_permission(tenant_id, 'marketing'));
drop policy if exists "tenant marketing versions read" on public.marketing_publication_versions;
create policy "tenant marketing versions read" on public.marketing_publication_versions for select to authenticated
using (public.has_tenant_permission(tenant_id, 'marketing'));
drop policy if exists "tenant automation runs read" on public.automation_runs;
create policy "tenant automation runs read" on public.automation_runs for select to authenticated
using (public.has_tenant_permission(tenant_id, 'marketing'));

revoke all on table public.marketing_publications, public.marketing_publication_versions, public.automation_runs from anon, authenticated;
grant select on table public.marketing_publications, public.marketing_publication_versions, public.automation_runs to authenticated;

create or replace function public.sync_marketing_entity(
  p_tenant_id uuid,
  p_kind text,
  p_entity_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_entity_id, '') = '' then return; end if;
  if p_kind = 'banner' then
    update public.banners set active = (p_status = 'published'), updated_at = now()
    where tenant_id = p_tenant_id and id = p_entity_id;
  elsif p_kind = 'coupon' then
    update public.coupons set active = (p_status = 'published'), updated_at = now()
    where tenant_id = p_tenant_id and id = p_entity_id;
  elsif p_kind = 'cashback' then
    update public.cashback_campaigns
    set status = case when p_status = 'published' then 'active' when p_status = 'archived' then 'ended' else 'paused' end,
        updated_at = now()
    where tenant_id = p_tenant_id and id = p_entity_id;
  elsif p_kind = 'message' then
    update public.message_automations
    set active = (p_status = 'published'),
        workflow_status = case when p_status = 'published' then 'active' else 'paused' end,
        updated_at = now()
    where tenant_id = p_tenant_id and id = p_entity_id;
  end if;
end;
$$;

revoke all on function public.sync_marketing_entity(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.save_marketing_publication(
  p_tenant_id uuid,
  p_id text,
  p_name text,
  p_description text,
  p_kind text,
  p_entity_id text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_owner_email text,
  p_reviewer_email text,
  p_notes text
)
returns public.marketing_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.marketing_publications%rowtype;
  v_saved public.marketing_publications%rowtype;
  v_actor_email text := '';
  v_revision integer := 1;
  v_status text := 'draft';
begin
  if not public.has_tenant_permission(p_tenant_id, 'marketing') then raise exception 'Acesso negado'; end if;
  if p_kind not in ('campaign', 'banner', 'coupon', 'cashback', 'message') then raise exception 'Tipo de publicação inválido'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Informe o nome da publicação'; end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'Período inválido'; end if;
  if p_kind <> 'campaign' and nullif(trim(p_entity_id), '') is null then raise exception 'Vincule um conteúdo'; end if;

  select email into v_actor_email from public.profiles where id = auth.uid();
  select * into v_existing from public.marketing_publications where tenant_id = p_tenant_id and id = p_id for update;
  if found then
    v_revision := v_existing.revision + 1;
    v_status := case when v_existing.status in ('in_review', 'approved', 'scheduled', 'published') then 'draft' else v_existing.status end;
    if v_existing.status in ('scheduled', 'published') then
      perform public.sync_marketing_entity(p_tenant_id, v_existing.kind, v_existing.entity_id, 'draft');
    end if;
  end if;

  insert into public.marketing_publications
    (id, tenant_id, name, description, kind, entity_id, status, starts_at, ends_at, owner_email, reviewer_email, revision, notes, created_at, updated_at)
  values
    (p_id, p_tenant_id, trim(p_name), coalesce(p_description, ''), p_kind, coalesce(p_entity_id, ''), v_status, p_starts_at, p_ends_at,
     lower(trim(p_owner_email)), lower(trim(coalesce(p_reviewer_email, ''))), v_revision, coalesce(p_notes, ''), now(), now())
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    kind = excluded.kind,
    entity_id = excluded.entity_id,
    status = v_status,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    owner_email = excluded.owner_email,
    reviewer_email = excluded.reviewer_email,
    revision = v_revision,
    notes = excluded.notes,
    updated_at = now()
  where public.marketing_publications.tenant_id = p_tenant_id
  returning * into v_saved;

  if v_saved.id is null then raise exception 'Publicação não encontrada neste tenant'; end if;
  insert into public.marketing_publication_versions
    (tenant_id, publication_id, revision, status, snapshot, note, actor_email)
  values
    (p_tenant_id, v_saved.id, v_saved.revision, v_saved.status, to_jsonb(v_saved) - 'tenant_id',
     case when v_existing.id is null then 'Rascunho criado' else 'Conteúdo atualizado' end, coalesce(v_actor_email, ''));
  return v_saved;
end;
$$;

create or replace function public.transition_marketing_publication(
  p_tenant_id uuid,
  p_publication_id text,
  p_status text,
  p_note text default ''
)
returns public.marketing_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication public.marketing_publications%rowtype;
  v_allowed boolean := false;
  v_actor_email text := '';
begin
  if not public.has_tenant_permission(p_tenant_id, 'marketing') then raise exception 'Acesso negado'; end if;
  select * into v_publication from public.marketing_publications
  where tenant_id = p_tenant_id and id = p_publication_id for update;
  if not found then raise exception 'Publicação não encontrada'; end if;

  v_allowed := case v_publication.status
    when 'draft' then p_status = 'in_review'
    when 'in_review' then p_status in ('draft', 'approved')
    when 'approved' then p_status in ('draft', 'scheduled', 'published')
    when 'scheduled' then p_status in ('draft', 'published', 'paused')
    when 'published' then p_status in ('paused', 'archived')
    when 'paused' then p_status in ('draft', 'scheduled', 'published', 'archived')
    when 'archived' then p_status = 'draft'
    else false end;
  if not v_allowed then raise exception 'Transição de publicação inválida'; end if;
  if p_status = 'approved' and trim(v_publication.reviewer_email) = '' then raise exception 'Defina um revisor antes da aprovação'; end if;

  select email into v_actor_email from public.profiles where id = auth.uid();
  update public.marketing_publications set
    status = p_status,
    revision = revision + 1,
    last_published_at = case when p_status = 'published' then now() else last_published_at end,
    updated_at = now()
  where tenant_id = p_tenant_id and id = p_publication_id
  returning * into v_publication;

  perform public.sync_marketing_entity(p_tenant_id, v_publication.kind, v_publication.entity_id, p_status);
  insert into public.marketing_publication_versions
    (tenant_id, publication_id, revision, status, snapshot, note, actor_email)
  values
    (p_tenant_id, v_publication.id, v_publication.revision, v_publication.status, to_jsonb(v_publication) - 'tenant_id', coalesce(p_note, ''), coalesce(v_actor_email, ''));
  return v_publication;
end;
$$;

create or replace function public.rollback_marketing_publication(
  p_tenant_id uuid,
  p_publication_id text,
  p_version_id uuid
)
returns public.marketing_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.marketing_publications%rowtype;
  v_version public.marketing_publication_versions%rowtype;
  v_snapshot jsonb;
  v_actor_email text := '';
begin
  if not public.has_tenant_permission(p_tenant_id, 'marketing') then raise exception 'Acesso negado'; end if;
  select * into v_current from public.marketing_publications where tenant_id = p_tenant_id and id = p_publication_id for update;
  if not found then raise exception 'Publicação não encontrada'; end if;
  select * into v_version from public.marketing_publication_versions
  where tenant_id = p_tenant_id and publication_id = p_publication_id and id = p_version_id;
  if not found then raise exception 'Versão não encontrada'; end if;
  v_snapshot := v_version.snapshot;
  select email into v_actor_email from public.profiles where id = auth.uid();

  perform public.sync_marketing_entity(p_tenant_id, v_current.kind, v_current.entity_id, 'draft');
  update public.marketing_publications set
    name = coalesce(v_snapshot->>'name', name),
    description = coalesce(v_snapshot->>'description', description),
    kind = coalesce(v_snapshot->>'kind', kind),
    entity_id = coalesce(v_snapshot->>'entity_id', entity_id),
    starts_at = coalesce((v_snapshot->>'starts_at')::timestamptz, starts_at),
    ends_at = nullif(v_snapshot->>'ends_at', '')::timestamptz,
    owner_email = coalesce(v_snapshot->>'owner_email', owner_email),
    reviewer_email = coalesce(v_snapshot->>'reviewer_email', reviewer_email),
    notes = coalesce(v_snapshot->>'notes', notes),
    status = 'draft',
    revision = v_current.revision + 1,
    updated_at = now()
  where tenant_id = p_tenant_id and id = p_publication_id
  returning * into v_current;

  insert into public.marketing_publication_versions
    (tenant_id, publication_id, revision, status, snapshot, note, actor_email)
  values
    (p_tenant_id, v_current.id, v_current.revision, v_current.status, to_jsonb(v_current) - 'tenant_id',
     'Rollback para a revisão ' || v_version.revision, coalesce(v_actor_email, ''));
  return v_current;
end;
$$;

create or replace function public.process_due_marketing_publications(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication public.marketing_publications%rowtype;
  v_count integer := 0;
begin
  if not public.has_tenant_permission(p_tenant_id, 'marketing') then raise exception 'Acesso negado'; end if;
  for v_publication in
    select * from public.marketing_publications
    where tenant_id = p_tenant_id
      and ((status = 'scheduled' and starts_at <= now()) or (status in ('published', 'scheduled') and ends_at is not null and ends_at < now()))
    order by starts_at
    for update skip locked
  loop
    update public.marketing_publications set
      status = case when v_publication.ends_at is not null and v_publication.ends_at < now() then 'archived' else 'published' end,
      revision = revision + 1,
      last_published_at = case when not (v_publication.ends_at is not null and v_publication.ends_at < now()) then now() else last_published_at end,
      updated_at = now()
    where id = v_publication.id
    returning * into v_publication;
    perform public.sync_marketing_entity(p_tenant_id, v_publication.kind, v_publication.entity_id, v_publication.status);
    insert into public.marketing_publication_versions
      (tenant_id, publication_id, revision, status, snapshot, note, actor_email)
    values (p_tenant_id, v_publication.id, v_publication.revision, v_publication.status, to_jsonb(v_publication) - 'tenant_id', 'Processamento automático do calendário', 'sistema');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.test_message_automation(
  p_tenant_id uuid,
  p_automation_id text,
  p_order_id text
)
returns public.automation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_automation public.message_automations%rowtype;
  v_order public.orders%rowtype;
  v_run public.automation_runs%rowtype;
  v_subject text;
  v_message text;
  v_recipient text;
  v_actor_email text := '';
begin
  if not public.has_tenant_permission(p_tenant_id, 'marketing') then raise exception 'Acesso negado'; end if;
  select * into v_automation from public.message_automations where tenant_id = p_tenant_id and id = p_automation_id;
  if not found then raise exception 'Automação não encontrada'; end if;
  select * into v_order from public.orders where tenant_id = p_tenant_id and id = p_order_id;
  if not found then raise exception 'Pedido de teste não encontrado'; end if;
  select email into v_actor_email from public.profiles where id = auth.uid();

  v_subject := replace(replace(replace(replace(v_automation.subject, '{{cliente}}', coalesce(v_order.customer->>'name', 'Cliente')), '{{pedido}}', v_order.code), '{{status}}', v_order.status), '{{total}}', 'R$ ' || replace(to_char(v_order.total, 'FM999G999G990D00'), '.', ','));
  v_message := replace(replace(replace(replace(v_automation.message, '{{cliente}}', coalesce(v_order.customer->>'name', 'Cliente')), '{{pedido}}', v_order.code), '{{status}}', v_order.status), '{{total}}', 'R$ ' || replace(to_char(v_order.total, 'FM999G999G990D00'), '.', ','));
  v_recipient := case when v_automation.channel = 'whatsapp' then coalesce(v_order.customer->>'phone', '') else coalesce(v_order.customer->>'email', '') end;

  insert into public.automation_runs
    (tenant_id, automation_id, automation_name, trigger_type, trigger_event, status, attempt, max_attempts, output, started_at, finished_at, actor_email)
  values
    (p_tenant_id, v_automation.id, v_automation.name, v_automation.trigger_type,
     jsonb_build_object('test', true, 'orderId', v_order.id, 'orderCode', v_order.code), 'simulated', 1, v_automation.max_retries + 1,
     jsonb_build_object('channel', v_automation.channel, 'recipient', v_recipient, 'subject', v_subject, 'message', v_message), now(), now(), coalesce(v_actor_email, ''))
  returning * into v_run;

  if coalesce((v_automation.actions->>'sendMessage')::boolean, true) then
    insert into public.message_logs
      (tenant_id, order_id, order_code, automation_id, automation_name, channel, recipient, subject, message, status, run_id, attempt)
    values
      (p_tenant_id, v_order.id, v_order.code, v_automation.id, v_automation.name, v_automation.channel, v_recipient, v_subject, v_message, 'simulated', v_run.id, 1);
  end if;
  update public.message_automations set last_tested_at = now(), run_count = run_count + 1, updated_at = now()
  where tenant_id = p_tenant_id and id = p_automation_id;
  return v_run;
end;
$$;

create or replace function public.retry_automation_run(
  p_tenant_id uuid,
  p_run_id uuid
)
returns public.automation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.automation_runs%rowtype;
begin
  if not public.has_tenant_permission(p_tenant_id, 'marketing') then raise exception 'Acesso negado'; end if;
  select * into v_run from public.automation_runs where tenant_id = p_tenant_id and id = p_run_id for update;
  if not found then raise exception 'Execução não encontrada'; end if;
  if v_run.status not in ('failed', 'retrying') then raise exception 'Somente falhas podem ser reenviadas'; end if;
  if v_run.attempt >= v_run.max_attempts then raise exception 'Limite de tentativas atingido'; end if;
  update public.automation_runs set
    status = 'simulated', attempt = attempt + 1, error_message = '', next_retry_at = null,
    started_at = now(), finished_at = now(), output = output || jsonb_build_object('retried', true)
  where tenant_id = p_tenant_id and id = p_run_id
  returning * into v_run;
  return v_run;
end;
$$;

create or replace function public.queue_order_status_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  automation public.message_automations%rowtype;
  rendered_subject text;
  rendered_message text;
  recipient text;
  customer_segment text := 'new';
  run_row public.automation_runs%rowtype;
  run_status text;
  run_error text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
  if new.customer_id is not null then customer_segment := public.cashback_customer_segment(new.tenant_id, new.customer_id); end if;

  for automation in
    select * from public.message_automations
    where tenant_id = new.tenant_id
      and active = true
      and workflow_status = 'active'
      and trigger_type = 'order_status'
      and trigger_value = new.status
      and new.total >= coalesce((conditions->>'minOrderTotal')::numeric, 0)
      and coalesce(conditions->>'orderSource', 'any') in ('any', coalesce(new.order_source, 'legacy'))
      and coalesce(conditions->>'customerSegment', 'all') in ('all', customer_segment)
    order by order_index
  loop
    rendered_subject := replace(replace(replace(replace(automation.subject, '{{cliente}}', coalesce(new.customer->>'name', 'Cliente')), '{{pedido}}', new.code), '{{status}}', new.status), '{{total}}', 'R$ ' || replace(to_char(new.total, 'FM999G999G990D00'), '.', ','));
    rendered_message := replace(replace(replace(replace(automation.message, '{{cliente}}', coalesce(new.customer->>'name', 'Cliente')), '{{pedido}}', new.code), '{{status}}', new.status), '{{total}}', 'R$ ' || replace(to_char(new.total, 'FM999G999G990D00'), '.', ','));
    recipient := case when automation.channel = 'whatsapp' then coalesce(new.customer->>'phone', '') else coalesce(new.customer->>'email', '') end;
    run_status := case when recipient = '' and coalesce((automation.actions->>'sendMessage')::boolean, true) then 'failed' else 'simulated' end;
    run_error := case when run_status = 'failed' then 'Destinatário não disponível' else '' end;

    insert into public.automation_runs
      (tenant_id, automation_id, automation_name, trigger_type, trigger_event, status, attempt, max_attempts, output, error_message, next_retry_at, started_at, finished_at, actor_email)
    values
      (new.tenant_id, automation.id, automation.name, automation.trigger_type,
       jsonb_build_object('orderId', new.id, 'orderCode', new.code, 'status', new.status, 'segment', customer_segment), run_status, 1, automation.max_retries + 1,
       jsonb_build_object('channel', automation.channel, 'recipient', recipient, 'subject', rendered_subject, 'message', rendered_message), run_error,
       case when run_status = 'failed' and automation.max_retries > 0 then now() + make_interval(mins => automation.retry_delay_minutes) else null end,
       now(), now(), 'sistema')
    returning * into run_row;

    if coalesce((automation.actions->>'sendMessage')::boolean, true) then
      insert into public.message_logs
        (tenant_id, order_id, order_code, automation_id, automation_name, channel, recipient, subject, message, status, run_id, attempt, error_message)
      values
        (new.tenant_id, new.id, new.code, automation.id, automation.name, automation.channel, recipient, rendered_subject, rendered_message,
         case when run_status = 'failed' then 'failed' else 'simulated' end, run_row.id, 1, run_error);
    end if;

    if new.customer_id is not null and coalesce((automation.actions->>'createTask')::boolean, false) then
      insert into public.customer_tasks
        (tenant_id, id, customer_id, title, priority, status, assigned_to, notes, created_at)
      values
        (new.tenant_id, 'automation-task-' || run_row.id::text, new.customer_id,
         coalesce(nullif(automation.actions->>'taskTitle', ''), 'Acompanhar ' || new.code), 'medium', 'open', '', 'Criada pela automação ' || automation.name, now())
      on conflict (id) do nothing;
    end if;

    if new.customer_id is not null and nullif(trim(automation.actions->>'addTag'), '') is not null then
      update public.customers set tags = case
        when automation.actions->>'addTag' = any(tags) then tags
        else array_append(tags, automation.actions->>'addTag') end,
        updated_at = now()
      where tenant_id = new.tenant_id and id = new.customer_id;
    end if;

    update public.message_automations set
      run_count = run_count + 1,
      failure_count = failure_count + case when run_status = 'failed' then 1 else 0 end,
      updated_at = now()
    where tenant_id = new.tenant_id and id = automation.id;
  end loop;
  return new;
end;
$$;

drop trigger if exists admin_audit_change on public.marketing_publications;
create trigger admin_audit_change after insert or update or delete on public.marketing_publications
for each row execute function public.capture_admin_audit();
drop trigger if exists admin_audit_change on public.message_automations;
create trigger admin_audit_change after insert or update or delete on public.message_automations
for each row execute function public.capture_admin_audit();

revoke all on function public.save_marketing_publication(uuid, text, text, text, text, text, timestamptz, timestamptz, text, text, text) from public, anon;
revoke all on function public.transition_marketing_publication(uuid, text, text, text) from public, anon;
revoke all on function public.rollback_marketing_publication(uuid, text, uuid) from public, anon;
revoke all on function public.process_due_marketing_publications(uuid) from public, anon;
revoke all on function public.test_message_automation(uuid, text, text) from public, anon;
revoke all on function public.retry_automation_run(uuid, uuid) from public, anon;
grant execute on function public.save_marketing_publication(uuid, text, text, text, text, text, timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.transition_marketing_publication(uuid, text, text, text) to authenticated;
grant execute on function public.rollback_marketing_publication(uuid, text, uuid) to authenticated;
grant execute on function public.process_due_marketing_publications(uuid) to authenticated;
grant execute on function public.test_message_automation(uuid, text, text) to authenticated;
grant execute on function public.retry_automation_run(uuid, uuid) to authenticated;
