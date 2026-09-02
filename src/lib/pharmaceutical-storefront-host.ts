export const defaultPharmaceuticalStorefrontHost = "farmaceuticos.juniorimportsoficial.com.br";

export function normalizeHostname(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().split(":")[0].replace(/\.$/, "");
}

export function isPharmaceuticalStorefrontHost(
  hostname: string | null | undefined,
  configuredHost = process.env.PHARMACEUTICAL_STOREFRONT_HOST || defaultPharmaceuticalStorefrontHost,
) {
  return normalizeHostname(hostname) === normalizeHostname(configuredHost);
}
