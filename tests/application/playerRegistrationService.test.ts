import { describe, expect, it, vi } from "vitest";
import { PlayerRegistrationService } from "../../src/application/registration/playerRegistrationService.js";

type PlayerRegistrationDatabase = ConstructorParameters<typeof PlayerRegistrationService>[0];

describe("PlayerRegistrationService", () => {
  it("registers a player in an alliance faculty", async () => {
    const db = createDb();
    db.alliance.findUnique.mockResolvedValue({ id: 1 });
    db.faculty.findFirst.mockResolvedValue({ id: 2 });
    db.user.upsert.mockResolvedValue({ id: 10 });
    db.user.findUnique.mockResolvedValue({
      id: 10,
      telegramId: 123n,
      displayName: "Merlin",
      characterName: "Merlin Ambrosius",
      className: "Mage",
      spec: "Fire",
      activeAlliance: {
        id: 1,
        name: "Magomir"
      }
    });
    db.allianceMember.findUnique.mockResolvedValue({
      faculty: {
        id: 2,
        name: "North",
        symbol: "N"
      }
    });

    const service = new PlayerRegistrationService(db);

    await expect(service.registerPlayer({
      telegramProfile: {
        telegramId: 123n,
        username: "merlin",
        displayName: "Merlin"
      },
      allianceId: 1,
      facultyId: 2,
      characterName: " Merlin Ambrosius ",
      className: " Mage ",
      spec: " Fire "
    })).resolves.toMatchObject({
      characterName: "Merlin Ambrosius",
      faculty: {
        id: 2
      }
    });

    expect(db.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        characterName: "Merlin Ambrosius",
        className: "Mage",
        spec: "Fire",
        activeAllianceId: 1
      }),
      update: expect.objectContaining({
        characterName: "Merlin Ambrosius",
        className: "Mage",
        spec: "Fire",
        activeAllianceId: 1
      })
    }));
    expect(db.allianceMember.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        allianceId: 1,
        userId: 10,
        facultyId: 2,
        className: "Mage",
        spec: "Fire"
      }),
      update: expect.objectContaining({
        facultyId: 2,
        className: "Mage",
        spec: "Fire"
      })
    }));
  });

  it("rejects a faculty outside selected alliance", async () => {
    const db = createDb();
    db.alliance.findUnique.mockResolvedValue({ id: 1 });
    db.faculty.findFirst.mockResolvedValue(null);
    const service = new PlayerRegistrationService(db);

    await expect(service.registerPlayer({
      telegramProfile: {
        telegramId: 123n,
        displayName: "Merlin"
      },
      allianceId: 1,
      facultyId: 2,
      characterName: "Merlin"
    })).rejects.toThrow("Faculty 2 was not found in alliance 1.");

    expect(db.user.upsert).not.toHaveBeenCalled();
    expect(db.allianceMember.upsert).not.toHaveBeenCalled();
  });

  it("lists visible faculties for registration", async () => {
    const db = createDb();
    db.alliance.findMany.mockResolvedValue([
      {
        id: 1,
        name: "Magomir",
        slug: "magomir",
        faculties: [
          {
            id: 2,
            name: "North",
            symbol: "N"
          }
        ]
      }
    ]);
    const service = new PlayerRegistrationService(db);

    await expect(service.listRegistrationAlliances()).resolves.toEqual([
      {
        id: 1,
        name: "Magomir",
        slug: "magomir",
        faculties: [
          {
            id: 2,
            name: "North",
            symbol: "N"
          }
        ]
      }
    ]);

    expect(db.alliance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        faculties: expect.objectContaining({
          where: {
            isHidden: false
          }
        })
      }),
      orderBy: {
        id: "asc"
      }
    }));
  });
});

function createDb(): PlayerRegistrationDatabase {
  return {
    alliance: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    faculty: {
      findFirst: vi.fn()
    },
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    },
    allianceMember: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  } as unknown as PlayerRegistrationDatabase;
}
