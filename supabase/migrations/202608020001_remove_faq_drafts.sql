begin;

-- Remove somente os rascunhos criados pelo antigo texto padrão do editor.
-- Perguntas reais, inclusive as cinco perguntas comerciais existentes, são preservadas.
delete from public.faqs
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and question = 'Nova pergunta?'
  and answer = 'Escreva a resposta de forma simples.';

commit;
