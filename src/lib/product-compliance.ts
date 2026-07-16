import type { CheckoutMode, Product, ProductType, RegulatoryStatus } from "@/types/store";

export const productTypeLabels: Record<ProductType, string> = {
  unclassified: "Sem classificação",
  non_medicine: "Item não medicamentoso",
  otc: "Medicamento isento de prescrição (MIP)",
  prescription: "Medicamento sob prescrição",
  controlled: "Medicamento controlado",
};

export const regulatoryStatusLabels: Record<RegulatoryStatus, string> = {
  pending: "Aguardando validação",
  approved: "Liberado para publicação",
  blocked: "Publicação bloqueada",
};

const anvisaRegistrationPattern = /^1[0-9.\/-]{8,}$/;

export function getProductComplianceIssues(product: Product): string[] {
  const issues: string[] = [];

  if (product.regulatoryStatus !== "approved") {
    issues.push(regulatoryStatusLabels[product.regulatoryStatus]);
  }

  if (product.productType === "unclassified") {
    issues.push("Classifique o tipo de produto");
  }

  if (product.productType === "prescription" || product.productType === "controlled") {
    issues.push("Este tipo de medicamento não pode ser promovido em uma vitrine pública");
  }

  if (product.productType === "otc") {
    if (!product.activeIngredient.trim()) issues.push("Informe o princípio ativo");
    if (!product.presentation.trim()) issues.push("Informe a apresentação");
    if (!anvisaRegistrationPattern.test(product.anvisaRegistration.trim())) {
      issues.push("Informe um registro Anvisa válido");
    }
    if (!product.regulatoryWarning.trim()) issues.push("Informe a advertência obrigatória");
    if (!product.pharmacistReviewed) issues.push("A revisão farmacêutica ainda não foi confirmada");
  }

  return [...new Set(issues)];
}

export function isProductPubliclySellable(product: Product): boolean {
  return product.active && getProductComplianceIssues(product).length === 0;
}

/**
 * O catálogo da Junior Imports finaliza solicitações pelo WhatsApp. Nesse modo,
 * um produto ativo e com estoque pode entrar no carrinho mesmo quando ainda
 * exige confirmação das informações pela loja. Itens bloqueados continuam fora
 * do fluxo e o modo demonstrativo mantém a regra regulatória mais restritiva.
 */
export function canAddProductToCart(product: Product, checkoutMode: CheckoutMode): boolean {
  if (!product.active || product.stock <= 0 || product.regulatoryStatus === "blocked") return false;
  return isProductPubliclySellable(product) || checkoutMode === "whatsapp";
}

export function isProductVisibleInCatalog(product: Product): boolean {
  return product.active;
}

export function productPublicationLabel(product: Product): string {
  if (!product.active) return "Oculto";
  if (isProductPubliclySellable(product)) return "Disponível para pedido";
  return "Visível para consulta";
}
