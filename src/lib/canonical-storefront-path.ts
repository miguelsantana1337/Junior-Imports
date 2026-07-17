export function getPrimaryStorefrontRedirectPath(
  pathname: string,
  primaryTenantSlug: string,
) {
  const prefix = `/loja/${primaryTenantSlug}`;

  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    return null;
  }

  return pathname.slice(prefix.length) || "/";
}
