-- Processa agendamentos vencidos na primeira leitura pública da loja.
-- A função não aceita conteúdo nem horário do cliente: apenas aplica registros
-- previamente aprovados e agendados pelo workflow administrativo.

create or replace function public.process_public_marketing_schedule(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication public.marketing_publications%rowtype;
  v_count integer := 0;
begin
  if not public.is_public_tenant(p_tenant_id) then return 0; end if;
  for v_publication in
    select * from public.marketing_publications
    where tenant_id = p_tenant_id
      and (
        (status = 'scheduled' and starts_at <= now())
        or (status in ('published', 'scheduled') and ends_at is not null and ends_at < now())
      )
    order by starts_at
    for update skip locked
  loop
    update public.marketing_publications set
      status = case when v_publication.ends_at is not null and v_publication.ends_at < now() then 'archived' else 'published' end,
      revision = revision + 1,
      last_published_at = case when not (v_publication.ends_at is not null and v_publication.ends_at < now()) then now() else last_published_at end,
      updated_at = now()
    where tenant_id = p_tenant_id and id = v_publication.id
    returning * into v_publication;

    perform public.sync_marketing_entity(p_tenant_id, v_publication.kind, v_publication.entity_id, v_publication.status);
    insert into public.marketing_publication_versions
      (tenant_id, publication_id, revision, status, snapshot, note, actor_email)
    values
      (p_tenant_id, v_publication.id, v_publication.revision, v_publication.status,
       to_jsonb(v_publication) - 'tenant_id', 'Processamento automático na vitrine', 'sistema');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.process_public_marketing_schedule(uuid) from public;
grant execute on function public.process_public_marketing_schedule(uuid) to anon, authenticated;
