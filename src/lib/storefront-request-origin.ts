export function hasAllowedStorefrontSource(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const declaredOrigin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");
  let sourceOrigin = declaredOrigin;

  if (!sourceOrigin && referer) {
    try {
      sourceOrigin = new URL(referer).origin;
    } catch {
      sourceOrigin = "";
    }
  }

  return Boolean(
    sourceOrigin
      && sourceOrigin === requestOrigin
      && fetchSite !== "cross-site",
  );
}
