begin;

create or replace function public.set_tenant_order_archived(
  p_tenant_id uuid,
  p_order_id text,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_actor text := coalesce(auth.jwt()->>'email', '');
  v_archived_at timestamptz := case when p_archived then now() else null end;
  v_lifecycle_version integer;
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders') then
    raise exception 'Acesso negado';
  end if;

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;

  if not found then raise exception 'Pedido não encontrado'; end if;
  if p_archived and v_order.operational_status not in ('Entregue', 'Cancelado') then
    raise exception 'Finalize ou cancele o pedido antes de arquivá-lo';
  end if;

  if p_archived then
    update public.orders
    set archived_at = v_archived_at, archived_by = v_actor
    where tenant_id = p_tenant_id and id = p_order_id
    returning lifecycle_version into v_lifecycle_version;
  else
    update public.orders
    set
      archived_at = null,
      archived_by = '',
      archive_after = null,
      lifecycle_version = lifecycle_version + 1
    where tenant_id = p_tenant_id and id = p_order_id
    returning lifecycle_version into v_lifecycle_version;
  end if;

  return jsonb_build_object(
    'id', p_order_id,
    'archived_at', v_archived_at,
    'archived_by', case when p_archived then v_actor else '' end,
    'archive_after', case when p_archived then v_order.archive_after else null end,
    'lifecycle_version', v_lifecycle_version
  );
end;
$$;

revoke all on function public.set_tenant_order_archived(uuid, text, boolean) from public, anon;
grant execute on function public.set_tenant_order_archived(uuid, text, boolean) to authenticated;

commit;
