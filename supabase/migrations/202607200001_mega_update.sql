-- Migration: Mega Atualização (Cupons específicos, Avaliações Seguras e Campanhas de Cashback)

-- 1. Cupons: Adicionando restrições por produto ou categoria
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS applicable_category_ids text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS applicable_product_ids text[] NOT NULL DEFAULT '{}';

-- 2. Avaliações (Product Reviews)
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id uuid NOT NULL,
  product_id text NOT NULL,
  customer_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_token text NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  
  CONSTRAINT product_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT product_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_tenant_id ON public.product_reviews USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews USING btree (product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_reviews_token ON public.product_reviews USING btree (review_token);

-- RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vitrines públicas podem ver avaliações aprovadas" ON public.product_reviews;
CREATE POLICY "Vitrines públicas podem ver avaliações aprovadas" ON public.product_reviews
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved' AND public.is_public_tenant(tenant_id));

DROP POLICY IF EXISTS "Qualquer pessoa com o token pode inserir avaliação" ON public.product_reviews;
CREATE POLICY "Qualquer pessoa com o token pode inserir avaliação" ON public.product_reviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending' AND public.is_public_tenant(tenant_id));

DROP POLICY IF EXISTS "Administradores podem gerenciar todas as avaliações" ON public.product_reviews;
CREATE POLICY "Administradores podem gerenciar todas as avaliações" ON public.product_reviews
  FOR ALL
  TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'catalog'))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'catalog'));
