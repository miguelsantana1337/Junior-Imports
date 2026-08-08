begin;

-- O snapshot depende de operadores JSONB que o linter do banco classifica
-- como estáveis. A marcação correta evita otimizações indevidas em auditorias.
alter function public.audit_safe_snapshot(text, jsonb) stable;

commit;
