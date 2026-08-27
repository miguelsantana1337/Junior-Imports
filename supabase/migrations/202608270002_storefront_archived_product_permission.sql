begin;

-- A view pública usa security_invoker e precisa ler este marcador para
-- ocultar produtos arquivados. O campo não contém dado comercial sensível.
grant select (deleted_at) on table public.products to anon, authenticated;

notify pgrst, 'reload schema';

commit;
