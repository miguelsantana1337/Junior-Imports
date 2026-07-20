import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const workDir = path.join(root, "output", "drive-product-photos");
const sourceDir = path.join(workDir, "source");
const manifestPath = path.join(workDir, "product-photo-map.json");
const beforePath = path.join(workDir, "before-product-images.json");
const resultPath = path.join(workDir, "update-result.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.");
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const mappings = manifest.mappings;
const skus = mappings.map((item) => item.sku);

if (new Set(skus).size !== skus.length) {
  throw new Error("O mapa possui SKU duplicado.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: products, error: productsError } = await supabase
  .from("products")
  .select("id,tenant_id,sku,name,image_url,image_urls")
  .in("sku", skus);

if (productsError) throw productsError;

const productsBySku = new Map();
for (const product of products ?? []) {
  const matches = productsBySku.get(product.sku) ?? [];
  matches.push(product);
  productsBySku.set(product.sku, matches);
}

const invalidMatches = mappings
  .map((mapping) => ({ sku: mapping.sku, count: productsBySku.get(mapping.sku)?.length ?? 0 }))
  .filter(({ count }) => count !== 1);

if (invalidMatches.length) {
  throw new Error(`Cada SKU deve identificar exatamente um produto: ${JSON.stringify(invalidMatches)}`);
}

const tenantIds = new Set(products.map((product) => product.tenant_id));
if (tenantIds.size !== 1) {
  throw new Error(`Os produtos pertencem a ${tenantIds.size} tenants; atualizacao cancelada.`);
}

const tenantId = [...tenantIds][0];
const before = products
  .map((product) => ({
    id: product.id,
    tenant_id: product.tenant_id,
    sku: product.sku,
    name: product.name,
    image_url: product.image_url,
    image_urls: product.image_urls,
  }))
  .sort((a, b) => a.sku.localeCompare(b.sku));

await fs.writeFile(beforePath, `${JSON.stringify({ saved_at: new Date().toISOString(), products: before }, null, 2)}\n`);

const uniqueFiles = [...new Set(mappings.flatMap((mapping) => mapping.files))];
const publicUrlByFile = new Map();

for (const fileName of uniqueFiles) {
  const filePath = path.join(sourceDir, fileName);
  const contents = await fs.readFile(filePath);
  const objectPath = `${tenantId}/drive-2026-07-19/${fileName.toLowerCase()}`;
  const { error: uploadError } = await supabase.storage
    .from("product-media")
    .upload(objectPath, contents, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "31536000",
    });
  if (uploadError) throw new Error(`Falha ao enviar ${fileName}: ${uploadError.message}`);
  const publicUrl = supabase.storage.from("product-media").getPublicUrl(objectPath).data.publicUrl;
  publicUrlByFile.set(fileName, publicUrl);
}

const updated = [];
for (const mapping of mappings) {
  const imageUrls = mapping.files.map((fileName) => publicUrlByFile.get(fileName));
  const { data, error } = await supabase
    .from("products")
    .update({ image_url: imageUrls[0], image_urls: imageUrls })
    .eq("tenant_id", tenantId)
    .eq("sku", mapping.sku)
    .select("id,sku,name,image_url,image_urls")
    .single();
  if (error) throw new Error(`Falha ao atualizar ${mapping.sku}: ${error.message}`);
  updated.push(data);
}

const { data: verified, error: verifyError } = await supabase
  .from("products")
  .select("id,sku,name,image_url,image_urls")
  .eq("tenant_id", tenantId)
  .in("sku", skus);

if (verifyError) throw verifyError;

for (const mapping of mappings) {
  const row = verified.find((product) => product.sku === mapping.sku);
  const expectedUrls = mapping.files.map((fileName) => publicUrlByFile.get(fileName));
  if (!row || row.image_url !== expectedUrls[0] || JSON.stringify(row.image_urls) !== JSON.stringify(expectedUrls)) {
    throw new Error(`A verificacao final falhou para ${mapping.sku}.`);
  }
}

const availabilityChecks = await Promise.all(
  [...publicUrlByFile.entries()].map(async ([fileName, publicUrl]) => {
    const response = await fetch(publicUrl, { method: "HEAD" });
    return { file: fileName, url: publicUrl, status: response.status, ok: response.ok };
  }),
);

const unavailable = availabilityChecks.filter((check) => !check.ok);
if (unavailable.length) {
  throw new Error(`Algumas imagens publicas nao responderam corretamente: ${JSON.stringify(unavailable)}`);
}

const result = {
  applied_at: new Date().toISOString(),
  tenant_id: tenantId,
  products_updated: updated.length,
  unique_images_uploaded: uniqueFiles.length,
  unmatched_images: manifest.unmatched.length,
  products: [...verified].sort((a, b) => a.sku.localeCompare(b.sku)),
  availability_checks: availabilityChecks,
};

await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  products_updated: result.products_updated,
  unique_images_uploaded: result.unique_images_uploaded,
  unmatched_images: result.unmatched_images,
  all_public_urls_available: unavailable.length === 0,
}, null, 2));
