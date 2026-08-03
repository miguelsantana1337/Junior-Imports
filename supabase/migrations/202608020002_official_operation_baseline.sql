alter table public.store_settings
  add column if not exists operation_started_at timestamptz;

comment on column public.store_settings.operation_started_at is
  'Data a partir da qual pedidos e lançamentos entram nos indicadores da operação oficial. O histórico anterior permanece preservado.';

update public.store_settings
set operation_started_at = timestamptz '2026-08-03 00:00:00-03'
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and id = 'default';
