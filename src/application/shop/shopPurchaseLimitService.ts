import type { PrismaClient } from "@prisma/client";
import { getWindowStart, type LimitCheckResult, type LimitUsageEntry } from "../../domain/limits/limitPolicy.js";
import { parseLimitPeriodKind } from "../../domain/limits/limitPeriodKind.js";
import { PURCHASE_STATUS } from "../../domain/shop/purchaseStatus.js";
import { mapLimitWindow } from "../limits/limitWindowMapper.js";
import {
  checkShopItemPurchaseLimit,
  type ShopItemPurchaseLimitPolicy
} from "./itemPurchaseLimitPolicy.js";

type ShopPurchaseLimitDatabase = Pick<PrismaClient, "shopItem" | "shopPurchase">;

export type CheckShopPurchaseInput = {
  userId: number;
  itemId: number;
  quantity: number;
  now?: Date;
};

export class ShopItemNotFoundError extends Error {
  public constructor(itemId: number) {
    super(`Shop item ${itemId} was not found.`);
    this.name = "ShopItemNotFoundError";
  }
}

export class ShopPurchaseLimitService {
  public constructor(private readonly db: ShopPurchaseLimitDatabase) {}

  public async checkPurchase(input: CheckShopPurchaseInput): Promise<LimitCheckResult> {
    const now = input.now ?? new Date();
    const item = await this.db.shopItem.findUnique({
      where: {
        id: input.itemId
      },
      select: {
        id: true,
        minQuantity: true,
        maxQuantityPerPurchase: true,
        periodQuantityLimit: true,
        limitPeriodKind: true,
        limitPeriodSeconds: true,
        limitStartsAt: true,
        limitEndsAt: true
      }
    });

    if (!item) {
      throw new ShopItemNotFoundError(input.itemId);
    }

    const policy = mapItemToPolicy(item);
    const windowStart = getWindowStart(policy.window, now);
    const purchases = await this.db.shopPurchase.findMany({
      where: {
        userId: input.userId,
        itemId: input.itemId,
        status: PURCHASE_STATUS.COMPLETED,
        createdAt: {
          gte: windowStart
        }
      },
      select: {
        quantity: true,
        createdAt: true
      }
    });

    return checkShopItemPurchaseLimit(policy, input.quantity, mapPurchasesToUsage(purchases), now);
  }
}

function mapItemToPolicy(item: {
  minQuantity: number;
  maxQuantityPerPurchase: number;
  periodQuantityLimit: number | null;
  limitPeriodKind: string;
  limitPeriodSeconds: number | null;
  limitStartsAt: Date | null;
  limitEndsAt: Date | null;
}): ShopItemPurchaseLimitPolicy {
  return {
    minQuantity: item.minQuantity,
    maxQuantityPerPurchase: item.maxQuantityPerPurchase,
    ...(item.periodQuantityLimit !== null ? { periodQuantityLimit: item.periodQuantityLimit } : {}),
    window: mapLimitWindow({
      periodKind: parseLimitPeriodKind(item.limitPeriodKind),
      periodSeconds: item.limitPeriodSeconds,
      startsAt: item.limitStartsAt,
      endsAt: item.limitEndsAt
    })
  };
}

function mapPurchasesToUsage(purchases: readonly { quantity: number; createdAt: Date }[]): LimitUsageEntry[] {
  return purchases.map((purchase) => ({
    value: purchase.quantity,
    occurredAt: purchase.createdAt
  }));
}
