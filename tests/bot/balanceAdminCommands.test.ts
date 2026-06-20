import { describe, expect, it } from "vitest";
import { parseAdjustBalanceArgs } from "../../src/bot/commands/balanceAdminCommands.js";

describe("parseAdjustBalanceArgs", () => {
  it("parses positive balance adjustment", () => {
    expect(parseAdjustBalanceArgs(["1", "2", "123456789", "+50", "награда"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        currencyId: 2,
        userRef: {
          kind: "telegram_id",
          telegramId: 123456789n
        },
        delta: 50,
        comment: "награда"
      }
    });
  });

  it("parses negative balance adjustment", () => {
    expect(parseAdjustBalanceArgs(["1", "2", "reply", "-10"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        currencyId: 2,
        userRef: {
          kind: "reply"
        },
        delta: -10
      }
    });
  });

  it("rejects zero balance adjustment", () => {
    expect(parseAdjustBalanceArgs(["1", "2", "123456789", "0"])).toMatchObject({
      ok: false
    });
  });
});
