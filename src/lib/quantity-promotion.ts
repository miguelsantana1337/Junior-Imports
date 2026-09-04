import { isStorePromotionActive } from "@/lib/store-promotion";
import type {
  CartLine,
  QuantityPromotionApplication,
  QuantityPromotionGift,
  StorefrontProduct,
  StoreSettings,
} from "@/types/store";

export interface QuantityPromotionResult {
  applied: boolean;
  discount: number;
  applications: QuantityPromotionApplication[];
  gifts: QuantityPromotionGift[];
  stockIssue: string;
}

export function calculateQuantityPromotion(
  lines: CartLine[],
  products: StorefrontProduct[],
  settings: StoreSettings,
  now = new Date(),
): QuantityPromotionResult {
  const empty: QuantityPromotionResult = { applied: false, discount: 0, applications: [], gifts: [], stockIssue: "" };
  const config = settings.quantityPromotion;
  if (!config?.enabled || !isStorePromotionActive(settings, now)) return empty;

  const productMap = new Map(products.map((product) => [product.id, product]));
  const quantityByProduct = new Map<string, number>();
  for (const line of lines) {
    quantityByProduct.set(line.productId, (quantityByProduct.get(line.productId) ?? 0) + Math.max(0, line.quantity));
  }
  const quantityFor = (productId: string) => quantityByProduct.get(productId) ?? 0;
  const configuredSingleIds = config.singleProductIds?.filter(Boolean) ?? [];
  const singleProductIds = [...new Set(configuredSingleIds.length ? configuredSingleIds : [config.singleProductId].filter(Boolean))];
  const configuredBoxMappings = config.boxProductMappings?.filter((mapping) => mapping.boxProductId && mapping.giftProductId) ?? [];
  const boxProductMappings = configuredBoxMappings.length
    ? configuredBoxMappings
    : config.boxProductId && config.singleProductId
      ? [{ boxProductId: config.boxProductId, giftProductId: config.singleProductId }]
      : [];
  const dose = productMap.get(config.doseProductId);
  const groupQuantity = Math.max(2, config.groupQuantity || 3);
  const discountPercent = Math.max(0, Math.min(100, config.groupDiscountPercent));
  let groupApplications = 0;
  let doseGiftQuantity = 0;
  let boxGiftQuantity = 0;
  let discount = 0;
  const applications: QuantityPromotionApplication[] = [];
  const giftsByProduct = new Map<string, QuantityPromotionGift>();

  for (const productId of singleProductIds) {
    const single = productMap.get(productId);
    if (!single) continue;
    const singleQuantity = quantityFor(single.id);
    const groups = config.repeatable
      ? Math.floor(singleQuantity / groupQuantity)
      : Number(singleQuantity >= groupQuantity);
    const groupUnits = groups * groupQuantity;
    const remainder = Math.max(0, singleQuantity - groupUnits);
    groupApplications += groups;
    doseGiftQuantity += remainder * Math.max(0, config.doseGiftPerRemainder || 0);
    discount += groups * single.price * discountPercent / 100;
  }

  for (const mapping of boxProductMappings) {
    const giftProduct = productMap.get(mapping.giftProductId);
    const boxQuantity = productMap.has(mapping.boxProductId) ? quantityFor(mapping.boxProductId) : 0;
    const giftQuantity = boxQuantity * Math.max(0, config.boxGiftQuantity || 0);
    if (!giftProduct || giftQuantity <= 0) continue;
    boxGiftQuantity += giftQuantity;
    const existing = giftsByProduct.get(giftProduct.id);
    if (existing) existing.quantity += giftQuantity;
    else giftsByProduct.set(giftProduct.id, { productId: giftProduct.id, name: giftProduct.name, quantity: giftQuantity });
  }

  if (groupApplications > 0) {
    applications.push({
      key: "group-discount",
      label: `${groupApplications} ${groupApplications === 1 ? "ampola com" : "ampolas com"} ${config.groupDiscountPercent}% OFF`,
      applications: groupApplications,
    });
  }
  if (doseGiftQuantity > 0 && dose) {
    const existing = giftsByProduct.get(dose.id);
    if (existing) existing.quantity += doseGiftQuantity;
    else giftsByProduct.set(dose.id, { productId: dose.id, name: dose.name, quantity: doseGiftQuantity });
    applications.push({
      key: "single-gift",
      label: `${doseGiftQuantity} ${doseGiftQuantity === 1 ? "dose extra de 2,5 mg" : "doses extras de 2,5 mg"}`,
      applications: doseGiftQuantity,
    });
  }
  if (boxGiftQuantity > 0) {
    applications.push({
      key: "box-gift",
      label: `${boxGiftQuantity} ${boxGiftQuantity === 1 ? "ampola grátis pela caixa" : "ampolas grátis pelas caixas"}`,
      applications: boxGiftQuantity,
    });
  }

  const gifts = [...giftsByProduct.values()];
  let stockIssue = "";
  for (const gift of gifts) {
    const product = productMap.get(gift.productId);
    const paidQuantity = quantityFor(gift.productId);
    if (!product?.active || product.stock < paidQuantity + gift.quantity) {
      stockIssue = `O benefício “${gift.name}” está sem estoque suficiente.`;
      break;
    }
  }

  return {
    applied: applications.length > 0,
    discount: Number(discount.toFixed(2)),
    applications,
    gifts,
    stockIssue,
  };
}
