begin;

alter table public.storefront_rate_limits
  drop constraint if exists storefront_rate_limits_action_check;

alter table public.storefront_rate_limits
  add constraint storefront_rate_limits_action_check
  check (action in ('order', 'coupon', 'password_reset', 'password_verify'));

create or replace function public.consume_storefront_rate_limit(
  p_tenant_id uuid,
  p_fingerprint_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.storefront_rate_limits%rowtype;
  v_retry_after integer := 0;
begin
  if p_action not in ('order', 'coupon', 'password_reset', 'password_verify') then
    raise exception 'Ação de segurança inválida';
  end if;
  if length(trim(coalesce(p_fingerprint_hash, ''))) < 16 then
    raise exception 'Identificador de segurança inválido';
  end if;
  if p_limit < 1 or p_limit > 100 or p_window_seconds < 10 or p_window_seconds > 86400 then
    raise exception 'Configuração de limite inválida';
  end if;

  delete from public.storefront_rate_limits
  where updated_at < now() - interval '2 days';

  insert into public.storefront_rate_limits
    (tenant_id, fingerprint_hash, action, request_count, window_started_at, updated_at)
  values
    (p_tenant_id, p_fingerprint_hash, p_action, 0, now(), now())
  on conflict (tenant_id, fingerprint_hash, action) do nothing;

  select * into v_row
  from public.storefront_rate_limits
  where tenant_id = p_tenant_id
    and fingerprint_hash = p_fingerprint_hash
    and action = p_action
  for update;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= now() then
    update public.storefront_rate_limits
    set request_count = 1, window_started_at = now(), updated_at = now()
    where tenant_id = p_tenant_id
      and fingerprint_hash = p_fingerprint_hash
      and action = p_action;
    return jsonb_build_object('allowed', true, 'remaining', p_limit - 1, 'retry_after', 0);
  end if;

  if v_row.request_count >= p_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_row.window_started_at + make_interval(secs => p_window_seconds) - now())))::integer
    );
    return jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', v_retry_after);
  end if;

  update public.storefront_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where tenant_id = p_tenant_id
    and fingerprint_hash = p_fingerprint_hash
    and action = p_action;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, p_limit - v_row.request_count - 1),
    'retry_after', 0
  );
end;
$$;

revoke all on function public.consume_storefront_rate_limit(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_storefront_rate_limit(uuid, text, text, integer, integer)
  to service_role;

commit;
