import { describe, expect, it, vi } from "vitest";
import { LogRoutingService } from "../../src/application/logs/logRoutingService.js";

type LogRoutingDatabase = ConstructorParameters<typeof LogRoutingService>[0];

describe("LogRoutingService", () => {
  it("loads a log target by id", async () => {
    const db = createDb();
    db.logTarget.findUnique.mockResolvedValue(createLogTarget({ id: 5 }));
    const service = new LogRoutingService(db);

    await expect(service.getTarget(5)).resolves.toMatchObject({
      id: 5,
      eventType: "FINANCE"
    });

    expect(db.logTarget.findUnique).toHaveBeenCalledWith({
      where: {
        id: 5
      },
      select: expect.any(Object)
    });
  });

  it("updates log target activity", async () => {
    const db = createDb();
    db.logTarget.update.mockResolvedValue(createLogTarget({ id: 7 }));
    const service = new LogRoutingService(db);

    await expect(service.setTargetActive({ targetId: 7, isActive: false })).resolves.toMatchObject({
      id: 7
    });

    expect(db.logTarget.update).toHaveBeenCalledWith({
      where: {
        id: 7
      },
      data: {
        isActive: false
      },
      select: expect.any(Object)
    });
  });
});

function createDb(): LogRoutingDatabase {
  return {
    logTarget: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  } as unknown as LogRoutingDatabase;
}

function createLogTarget(overrides: { id: number }) {
  return {
    id: overrides.id,
    allianceId: 1,
    scope: "LOCAL",
    eventType: "FINANCE",
    chatId: -100123n,
    topicId: null,
    title: null,
    sourceTargetId: null
  };
}
