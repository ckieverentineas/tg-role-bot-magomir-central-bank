import { describe, expect, it, vi } from "vitest";
import { AccountQueryService } from "../../src/application/read/accountQueryService.js";

type AccountQueryDatabase = ConstructorParameters<typeof AccountQueryService>[0];

describe("AccountQueryService", () => {
  it("does not return hidden shops by direct id", async () => {
    const db = createDb();
    db.shop.findFirst.mockResolvedValue(null);
    const service = new AccountQueryService(db);

    await expect(service.getShopItems(10)).resolves.toBeNull();

    expect(db.shop.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 10,
          isHidden: false
        }
      })
    );
  });
});

function createDb(): AccountQueryDatabase {
  return {
    user: {
      findUnique: vi.fn()
    },
    alliance: {
      findUnique: vi.fn()
    },
    balance: {},
    shop: {
      findFirst: vi.fn()
    },
    inventoryItem: {},
    sbpTransfer: {
      findMany: vi.fn()
    },
    shopPurchase: {
      findMany: vi.fn()
    }
  } as unknown as AccountQueryDatabase;
}
