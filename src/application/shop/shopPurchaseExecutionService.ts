import type { Prisma, PrismaClient } from "@prisma/client";
import { LOG_EVENT_TYPE } from "../../domain/logs/logEventType.js";
import { multiplyMoney, toMoneyNumber } from "../../domain/money/money.js";
import { PURCHASE_STATUS } from "../../domain/shop/purchaseStatus.js";
import { ShopPurchaseLimitService } from "./shopPurchaseLimitService.js";

export type ExecuteShopPurchaseInput = {
  userId: number;
  itemId: number;
  quantity: number;
  now?: Date;
};

export type ExecutedShopPurchase = {
  id: number;
  allianceId: number;
  itemId: number;
  itemName: string;
  userId: number;
  userDisplayName: string;
  currencyId: number;
  currencySymbol: string;
  quantity: number;
  totalPrice: number;
  createdAt: Date;
  logEventType: typeof LOG_EVENT_TYPE.PURCHASE;
  logText: string;
};

type ShopPurchaseExecutionDatabase = Pick<
  PrismaClient,
  "$transaction" | "shopItem" | "allianceMember" | "shopPurchase" | "balance" | "inventoryItem"
>;

export class ShopPurchaseExecutionService {
  public constructor(private readonly db: ShopPurchaseExecutionDatabase) {}

  public async execute(input: ExecuteShopPurchaseInput): Promise<ExecutedShopPurchase> {
    validatePurchaseInput(input);

    return this.db.$transaction(async (tx) => {
      const item = await tx.shopItem.findUnique({
        where: {
          id: input.itemId
        },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          isHidden: true,
          currencyId: true,
          currency: {
            select: {
              symbol: true
            }
          },
          shop: {
            select: {
              allianceId: true,
              isHidden: true
            }
          }
        }
      });

      if (!item || item.isHidden || item.shop.isHidden) {
        throw new Error(`Shop item ${input.itemId} was not found.`);
      }

      if (item.stock !== null && item.stock < input.quantity) {
        throw new Error("Not enough items in stock.");
      }

      await assertAllianceMember(tx, item.shop.allianceId, input.userId);

      const limitResult = await new ShopPurchaseLimitService(tx).checkPurchase(input);
      if (!limitResult.allowed) {
        throw new Error(limitResult.message);
      }

      const totalPrice = multiplyMoney(item.price, input.quantity);
      const balance = await tx.balance.findUnique({
        where: {
          userId_currencyId: {
            userId: input.userId,
            currencyId: item.currencyId
          }
        },
        select: {
          amount: true
        }
      });

      const currentBalance = balance ? toMoneyNumber(balance.amount) : 0;
      if (currentBalance < totalPrice) {
        throw new Error("Insufficient balance for purchase.");
      }

      await tx.balance.update({
        where: {
          userId_currencyId: {
            userId: input.userId,
            currencyId: item.currencyId
          }
        },
        data: {
          amount: {
            decrement: totalPrice
          }
        }
      });

      if (item.stock !== null) {
        await tx.shopItem.update({
          where: {
            id: item.id
          },
          data: {
            stock: {
              decrement: input.quantity
            }
          }
        });
      }

      const purchase = await tx.shopPurchase.create({
        data: {
          userId: input.userId,
          itemId: input.itemId,
          quantity: input.quantity,
          totalPrice,
          status: PURCHASE_STATUS.COMPLETED,
          inventory: {
            create: {
              userId: input.userId,
              itemId: input.itemId,
              quantity: input.quantity
            }
          }
        },
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              displayName: true
            }
          }
        }
      });

      return {
        id: purchase.id,
        allianceId: item.shop.allianceId,
        itemId: item.id,
        itemName: item.name,
        userId: input.userId,
        userDisplayName: purchase.user.displayName,
        currencyId: item.currencyId,
        currencySymbol: item.currency.symbol,
        quantity: input.quantity,
        totalPrice,
        createdAt: purchase.createdAt,
        logEventType: LOG_EVENT_TYPE.PURCHASE,
        logText: formatPurchaseLog({
          id: purchase.id,
          itemName: item.name,
          userDisplayName: purchase.user.displayName,
          quantity: input.quantity,
          totalPrice,
          currencySymbol: item.currency.symbol
        })
      };
    });
  }
}

async function assertAllianceMember(
  tx: Pick<Prisma.TransactionClient, "allianceMember">,
  allianceId: number,
  userId: number
): Promise<void> {
  const member = await tx.allianceMember.findUnique({
    where: {
      allianceId_userId: {
        allianceId,
        userId
      }
    },
    select: {
      id: true
    }
  });

  if (!member) {
    throw new Error("Buyer must be an alliance member.");
  }
}

function validatePurchaseInput(input: ExecuteShopPurchaseInput): void {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Purchase quantity must be a positive integer.");
  }
}

function formatPurchaseLog(input: {
  id: number;
  itemName: string;
  userDisplayName: string;
  quantity: number;
  totalPrice: number;
  currencySymbol: string;
}): string {
  return [
    `Покупка #${input.id}`,
    `${input.userDisplayName} купил(а): ${input.itemName}`,
    `Количество: ${input.quantity}`,
    `Сумма: ${input.totalPrice} ${input.currencySymbol}`
  ].join("\n");
}
