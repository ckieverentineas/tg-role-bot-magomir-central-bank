import { describe, expect, it, vi } from "vitest";
import { AdminSetupService } from "../../src/application/setup/adminSetupService.js";
import { BANK_ROLE } from "../../src/domain/users/bankRole.js";

type AdminSetupDatabase = ConstructorParameters<typeof AdminSetupService>[0];

describe("AdminSetupService", () => {
  it("keeps an existing member role when setting balance", async () => {
    const db = createDb();
    db.currency.findFirst.mockResolvedValue({ id: 2 });
    db.user.upsert.mockResolvedValue({ id: 10 });
    db.allianceMember.upsert.mockResolvedValue({ id: 20 });
    db.balance.upsert.mockResolvedValue({
      userId: 10,
      currencyId: 2,
      amount: 150,
      user: {
        displayName: "Архимаг"
      },
      currency: {
        symbol: "G"
      }
    });

    const service = new AdminSetupService(db);

    await service.setBalance({
      allianceId: 1,
      currencyId: 2,
      user: {
        telegramId: 123n,
        displayName: "Архимаг"
      },
      amount: 150
    });

    expect(db.allianceMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          allianceId_userId: {
            allianceId: 1,
            userId: 10
          }
        },
        create: {
          allianceId: 1,
          userId: 10,
          role: BANK_ROLE.MEMBER
        },
        update: {}
      })
    );
  });

  it("updates shop visibility", async () => {
    const db = createDb();
    db.shop.update.mockResolvedValue({
      id: 3,
      allianceId: 1,
      name: "Main Shop"
    });
    const service = new AdminSetupService(db);

    await expect(service.setShopVisibility({ shopId: 3, isHidden: true })).resolves.toMatchObject({
      id: 3,
      allianceId: 1,
      name: "Main Shop"
    });

    expect(db.shop.update).toHaveBeenCalledWith({
      where: {
        id: 3
      },
      data: {
        isHidden: true
      },
      select: expect.any(Object)
    });
  });

  it("updates shop item visibility", async () => {
    const db = createDb();
    db.shopItem.update.mockResolvedValue({
      id: 4,
      shopId: 3,
      currencyId: 2,
      name: "Magic Book",
      price: 10,
      stock: null,
      shop: {
        allianceId: 1
      }
    });
    const service = new AdminSetupService(db);

    await expect(service.setShopItemVisibility({ itemId: 4, isHidden: false })).resolves.toMatchObject({
      id: 4,
      shopId: 3,
      name: "Magic Book"
    });

    expect(db.shopItem.update).toHaveBeenCalledWith({
      where: {
        id: 4
      },
      data: {
        isHidden: false
      },
      select: expect.any(Object)
    });
  });
});

function createDb(): AdminSetupDatabase {
  return {
    alliance: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    },
    currency: {
      findFirst: vi.fn(),
      upsert: vi.fn()
    },
    user: {
      upsert: vi.fn()
    },
    allianceMember: {
      upsert: vi.fn()
    },
    balance: {
      upsert: vi.fn()
    },
    shop: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    },
    shopItem: {
      update: vi.fn(),
      upsert: vi.fn()
    }
  } as unknown as AdminSetupDatabase;
}
