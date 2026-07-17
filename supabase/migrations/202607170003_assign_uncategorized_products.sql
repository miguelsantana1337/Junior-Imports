-- Garante que todos os medicamentos existentes apareçam na categoria correta.

update public.products
set
  category_id = 'cat-4',
  updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000100'
  and slug in (
    'minoxidil-kirkland-60-ml',
    'lispax-50mg-lisdexanfetamina',
    'sibutramina-15mg',
    'ritalina-10-mg-metilfenidato'
  );
