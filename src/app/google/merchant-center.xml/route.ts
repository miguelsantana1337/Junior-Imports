import { getElectronicsStoreData } from "@/lib/electronics-store-data";
import { electronicsStorefrontUrl } from "@/lib/storefront-seo";

export const revalidate = 300;

function xml(value: string | number) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET() {
  const data = await getElectronicsStoreData();
  // Products under inquiry/made-to-order are intentionally excluded until the
  // store records a truthful ship-ready availability (and identifiers, when
  // assigned). This avoids sending a different promise to Google and shoppers.
  const eligible = data.products.filter((product) =>
    product.active && !product.madeToOrder && product.stock > 0 && product.price > 0 && product.imageUrl,
  );
  const items = eligible.map((product) => `
    <item>
      <g:id>${xml(product.id)}</g:id>
      <title>${xml(product.name)}</title>
      <description>${xml(product.description || product.name)}</description>
      <link>${xml(electronicsStorefrontUrl(`/produtos/${product.slug}`))}</link>
      <g:image_link>${xml(product.imageUrl)}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>${product.price.toFixed(2)} BRL</g:price>
      ${product.brand ? `<g:brand>${xml(product.brand)}</g:brand>` : ""}
      <g:product_type>${xml(`Eletrônicos > ${product.category}`)}</g:product_type>
    </item>`).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(`${data.settings.storeName} — Eletrônicos`)}</title>
    <link>${xml(electronicsStorefrontUrl())}</link>
    <description>Catálogo de eletrônicos elegíveis para compra online.</description>${items}
  </channel>
</rss>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600", "X-Merchant-Eligible-Items": String(eligible.length) } });
}
