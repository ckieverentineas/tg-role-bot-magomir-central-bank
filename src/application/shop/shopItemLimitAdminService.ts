import type { Prisma, PrismaClient } from "@prisma/client";
import type { LimitPeriodInput } from "../limits/limitPeriodInput.js";

const shopItemLimitSelect = {
  id: true,
  name: true,
  minQuantity: true,
  maxQuantityPerPurchase: true,
  periodQuantityLimit: true,
  limitPeriodKind: true,
  limitPeriodSeconds: true,
  limitStartsAt: true,
  limitEndsAt: true
} satisfies Prisma.ShopItemSelect;

export type ShopItemLimitView = Prisma.ShopItemGetPayload<{
  select: typeof shopItemLimitSelect;
}>;

export type SetShopItemLimitInput = {
  itemId: number;
  minQuantity: number;
  maxQuantityPerPurchase: number;
  periodQuantityLimit?: number;
  period: LimitPeriodInput;
};

export class ShopItemLimitAdminService {
  public constructor(private readonly db: PrismaClient) {}

  public async setLimit(input: SetShopItemLimitInput): Promise<ShopItemLimitView> {
    validateShopItemLimit(input);

    return this.db.shopItem.update({
      where: {
        id: input.itemId
      },
      data: {
        minQuantity: input.minQuantity,
        maxQuantityPerPurchase: input.maxQuantityPerPurchase,
        periodQuantityLimit: input.periodQuantityLimit ?? null,
        limitPeriodKind: input.period.periodKind,
        limitPeriodSeconds: input.period.periodSeconds,
        limitStartsAt: input.period.startsAt,
        limitEndsAt: input.period.endsAt
      },
      select: shopItemLimitSelect
    });
  }
}

function validateShopItemLimit(input: SetShopItemLimitInput): void {
  if (!Number.isSafeInteger(input.minQuantity) || input.minQuantity <= 0) {
    throw new Error("Shop item min quantity must be a positive integer.");
  }

  if (!Number.isSafeInteger(input.maxQuantityPerPurchase) || input.maxQuantityPerPurchase <= 0) {
    throw new Error("Shop item max quantity must be a positive integer.");
  }

  if (input.minQuantity > input.maxQuantityPerPurchase) {
    throw new Error("Shop item min quantity cannot be greater than max quantity.");
  }

  if (input.periodQuantityLimit !== undefined) {
    if (!Number.isSafeInteger(input.periodQuantityLimit) || input.periodQuantityLimit <= 0) {
      throw new Error("Shop item period quantity limit must be a positive integer.");
    }

    if (input.periodQuantityLimit < input.maxQuantityPerPurchase) {
      throw new Error("Shop item period quantity limit cannot be lower than max quantity.");
    }
  }
}
