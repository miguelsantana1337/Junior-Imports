export function withStorefrontPath(basePath: string, href: string) {
  if (!basePath || !href || /^(?:https?:|mailto:|tel:)/i.test(href)) return href;
  if (href === "/") return basePath;
  if (href.startsWith("/#")) return `${basePath}${href.slice(1)}`;
  if (href.startsWith("#")) return `${basePath}${href}`;
  if (href.startsWith("/")) return `${basePath}${href}`;
  return href;
}
