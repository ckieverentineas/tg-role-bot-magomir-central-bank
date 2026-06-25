import { describe, expect, it, vi } from "vitest";
import { ShopPurchaseExecutionService } from "../../src/application/shop/shopPurchaseExecutionService.js";

type ShopPurchaseExecutionDatabase = ConstructorParameters<typeof ShopPurchaseExecutionService>[0];

describe("ShopPurchaseExecutionService", () => {
  it("rejects purchases from hidden shops", async () => {
    const db = createDb();
    const tx = createTransaction();
    db.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.shopItem.findUnique.mockResolvedValue({
      id: 10,
      name: "Hidden item",
      price: 25,
      stock: null,
      isHidden: false,
      currencyId: 2,
      currency: {
        symbol: "G"
      },
      shop: {
        allianceId: 1,
        isHidden: true
      }
    });
    const service = new ShopPurchaseExecutionService(db);

    await expect(service.execute({ userId: 5, itemId: 10, quantity: 1 })).rejects.toThrow(
      "Shop item 10 was not found."
    );

    expect(tx.allianceMember.findUnique).not.toHaveBeenCalled();
    expect(tx.balance.update).not.toHaveBeenCalled();
    expect(tx.shopPurchase.create).not.toHaveBeenCalled();
  });
});

function createDb(): ShopPurchaseExecutionDatabase {
  return {
    $transaction: vi.fn(),
    shopItem: {},
    allianceMember: {},
    shopPurchase: {},
    balance: {},
    inventoryItem: {}
  } as unknown as ShopPurchaseExecutionDatabase;
}

function createTransaction() {
  return {
    shopItem: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    allianceMember: {
      findUnique: vi.fn()
    },
    shopPurchase: {
      create: vi.fn()
    },
    balance: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    inventoryItem: {}
  };
}
