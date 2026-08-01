-- Public storefront policies reference these helpers in OR expressions.
-- PostgreSQL does not guarantee short-circuit evaluation, so anonymous reads
-- must be allowed to execute the helpers even though they always return false
-- without an authenticated AAL2 session.
grant execute on function public.is_platform_admin() to anon;
grant execute on function public.has_tenant_permission(uuid, text) to anon;
