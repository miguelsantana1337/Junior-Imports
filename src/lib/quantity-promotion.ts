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
  const quantityFor = (productId: string) => Math.max(0, lines.find((line) => line.productId === productId)?.quantity ?? 0);
  const single = productMap.get(config.singleProductId);
  const box = productMap.get(config.boxProductId);
  const dose = productMap.get(config.doseProductId);
  const singleQuantity = single ? quantityFor(single.id) : 0;
  const boxQuantity = box ? quantityFor(box.id) : 0;
  const groupQuantity = Math.max(2, config.groupQuantity || 3);
  const groups = config.repeatable
    ? Math.floor(singleQuantity / groupQuantity)
    : Number(singleQuantity >= groupQuantity);
  const groupUnits = groups * groupQuantity;
  const remainder = Math.max(0, singleQuantity - groupUnits);
  const doseGiftQuantity = remainder * Math.max(0, config.doseGiftPerRemainder || 0);
  const boxGiftQuantity = boxQuantity * Math.max(0, config.boxGiftQuantity || 0);
  const applications: QuantityPromotionApplication[] = [];
  const gifts: QuantityPromotionGift[] = [];

  if (groups > 0 && single) {
    applications.push({
      key: "group-discount",
      label: `${groups} ${groups === 1 ? "ampola com" : "ampolas com"} ${config.groupDiscountPercent}% OFF`,
      applications: groups,
    });
  }
  if (doseGiftQuantity > 0 && dose) {
    gifts.push({ productId: dose.id, name: dose.name, quantity: doseGiftQuantity });
    applications.push({
      key: "single-gift",
      label: `${doseGiftQuantity} ${doseGiftQuantity === 1 ? "dose extra de 2,5 mg" : "doses extras de 2,5 mg"}`,
      applications: doseGiftQuantity,
    });
  }
  if (boxGiftQuantity > 0 && single) {
    const existing = gifts.find((gift) => gift.productId === single.id);
    if (existing) existing.quantity += boxGiftQuantity;
    else gifts.push({ productId: single.id, name: single.name, quantity: boxGiftQuantity });
    applications.push({
      key: "box-gift",
      label: `${boxGiftQuantity} ${boxGiftQuantity === 1 ? "ampola grátis pela caixa" : "ampolas grátis pelas caixas"}`,
      applications: boxGiftQuantity,
    });
  }

  let stockIssue = "";
  for (const gift of gifts) {
    const product = productMap.get(gift.productId);
    const paidQuantity = quantityFor(gift.productId);
    if (!product?.active || product.stock < paidQuantity + gift.quantity) {
      stockIssue = `O benefício “${gift.name}” está sem estoque suficiente.`;
      break;
    }
  }

  const discount = single
    ? groups * single.price * Math.max(0, Math.min(100, config.groupDiscountPercent)) / 100
    : 0;

  return {
    applied: applications.length > 0,
    discount: Number(discount.toFixed(2)),
    applications,
    gifts,
    stockIssue,
  };
}
