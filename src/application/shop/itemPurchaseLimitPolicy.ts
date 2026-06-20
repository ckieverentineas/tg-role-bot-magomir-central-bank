import {
  checkRangedLimit,
  type LimitCheckResult,
  type LimitUsageEntry,
  type LimitWindow
} from "../../domain/limits/limitPolicy.js";

export type ShopItemPurchaseLimitPolicy = {
  minQuantity: number;
  maxQuantityPerPurchase: number;
  periodQuantityLimit?: number;
  window: LimitWindow;
};

export function checkShopItemPurchaseLimit(
  policy: ShopItemPurchaseLimitPolicy,
  quantity: number,
  purchases: readonly LimitUsageEntry[],
  now = new Date()
): LimitCheckResult {
  if (!Number.isInteger(quantity)) {
    return {
      allowed: false,
      reason: "INVALID_VALUE",
      message: "Количество товара должно быть целым числом.",
      usedInPeriod: 0
    };
  }

  return checkRangedLimit(
    {
      minValue: policy.minQuantity,
      maxValue: policy.maxQuantityPerPurchase,
      ...(policy.periodQuantityLimit !== undefined ? { periodLimit: policy.periodQuantityLimit } : {}),
      window: policy.window
    },
    quantity,
    purchases,
    now
  );
}
