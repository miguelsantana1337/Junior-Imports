begin;

alter function public.audit_safe_snapshot(text, jsonb) stable;

commit;
