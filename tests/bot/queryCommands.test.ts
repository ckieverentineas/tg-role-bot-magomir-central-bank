import { describe, expect, it } from "vitest";
import { parseBalanceArgs } from "../../src/bot/commands/queryCommands.js";

describe("parseBalanceArgs", () => {
  it("parses own balance request", () => {
    expect(parseBalanceArgs(["1"])).toEqual({
      ok: true,
      value: {
        allianceId: 1
      }
    });
  });

  it("parses another user balance request", () => {
    expect(parseBalanceArgs(["1", "123456789"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        userRef: {
          kind: "telegram_id",
          telegramId: 123456789n
        }
      }
    });
  });

  it("rejects missing alliance id", () => {
    expect(parseBalanceArgs([])).toMatchObject({
      ok: false
    });
  });
});
