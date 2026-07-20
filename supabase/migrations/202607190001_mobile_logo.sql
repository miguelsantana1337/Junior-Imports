alter table public.store_settings
  add column if not exists mobile_logo_url text not null default '';
