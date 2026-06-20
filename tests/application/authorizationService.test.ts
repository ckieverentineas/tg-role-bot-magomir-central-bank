import { describe, expect, it, vi } from "vitest";
import { AuthorizationService } from "../../src/application/auth/authorizationService.js";

type AuthorizationDatabase = ConstructorParameters<typeof AuthorizationService>[0];

describe("AuthorizationService", () => {
  it("allows global admins without database lookup", async () => {
    const db = createDb();
    const service = new AuthorizationService(db, {
      botToken: "token",
      databaseUrl: "file:./dev.db",
      adminTelegramIds: [100n]
    });

    await expect(service.canManageAlliance(100n, 1)).resolves.toBe(true);
    expect(db.allianceMember.findFirst).not.toHaveBeenCalled();
  });

  it("allows bank admins inside the alliance", async () => {
    const db = createDb();
    db.allianceMember.findFirst.mockResolvedValue({ id: 1 });
    const service = new AuthorizationService(db, {
      botToken: "token",
      databaseUrl: "file:./dev.db",
      adminTelegramIds: []
    });

    await expect(service.canManageAlliance(200n, 1)).resolves.toBe(true);
  });

  it("denies users without scoped admin membership", async () => {
    const db = createDb();
    db.allianceMember.findFirst.mockResolvedValue(null);
    const service = new AuthorizationService(db, {
      botToken: "token",
      databaseUrl: "file:./dev.db",
      adminTelegramIds: []
    });

    await expect(service.canManageAlliance(200n, 1)).resolves.toBe(false);
  });

  it("checks shop item alliance scope", async () => {
    const db = createDb();
    db.shopItem.findUnique.mockResolvedValue({
      shop: {
        allianceId: 7
      }
    });
    db.allianceMember.findFirst.mockResolvedValue({ id: 1 });
    const service = new AuthorizationService(db, {
      botToken: "token",
      databaseUrl: "file:./dev.db",
      adminTelegramIds: []
    });

    await expect(service.canManageShopItem(200n, 10)).resolves.toBe(true);
    expect(db.allianceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          allianceId: 7
        })
      })
    );
  });
});

function createDb(): AuthorizationDatabase {
  return {
    allianceMember: {
      findFirst: vi.fn()
    },
    shop: {
      findUnique: vi.fn()
    },
    shopItem: {
      findUnique: vi.fn()
    }
  } as unknown as AuthorizationDatabase;
}
