import type { Product, ProductType, RegulatoryStatus } from "@/types/store";

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

export function isProductVisibleInCatalog(product: Product): boolean {
  return product.active;
}

export function productPublicationLabel(product: Product): string {
  if (!product.active) return "Oculto";
  if (isProductPubliclySellable(product)) return "Disponível para pedido";
  return "Visível para consulta";
}
