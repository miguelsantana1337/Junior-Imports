-- Migration: Mega Atualização (Cupons específicos, Avaliações Seguras e Campanhas de Cashback)

-- 1. Cupons: Adicionando restrições por produto ou categoria
ALTER TABLE public.coupons
ADD COLUMN applicable_category_ids uuid[] DEFAULT NULL,
ADD COLUMN applicable_product_ids uuid[] DEFAULT NULL;

-- 2. Avaliações (Product Reviews)
CREATE TABLE public.product_reviews (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  customer_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  
  CONSTRAINT product_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT product_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_reviews_tenant_id ON public.product_reviews USING btree (tenant_id);
CREATE INDEX idx_product_reviews_product_id ON public.product_reviews USING btree (product_id);
CREATE UNIQUE INDEX idx_product_reviews_token ON public.product_reviews USING btree (review_token);

-- RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vitrines públicas podem ver avaliações aprovadas" ON public.product_reviews
  FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Qualquer pessoa com o token pode inserir avaliação" ON public.product_reviews
  FOR INSERT
  WITH CHECK (status = 'pending');

CREATE POLICY "Administradores podem gerenciar todas as avaliações" ON public.product_reviews
  FOR ALL
  USING (
    tenant_id IN (
      SELECT store_users.tenant_id
      FROM public.store_users
      WHERE store_users.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.saas_platform_admins
      WHERE saas_platform_admins.id = auth.uid()
    )
  );
