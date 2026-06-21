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
});

function createDb(): AdminSetupDatabase {
  return {
    currency: {
      findFirst: vi.fn()
    },
    user: {
      upsert: vi.fn()
    },
    allianceMember: {
      upsert: vi.fn()
    },
    balance: {
      upsert: vi.fn()
    }
  } as unknown as AdminSetupDatabase;
}
