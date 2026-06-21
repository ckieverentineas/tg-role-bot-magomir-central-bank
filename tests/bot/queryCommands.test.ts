import { describe, expect, it } from "vitest";
import { parseBalanceArgs, parseHistoryArgs } from "../../src/bot/commands/queryCommands.js";

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

describe("parseHistoryArgs", () => {
  it("parses own history with default limit", () => {
    expect(parseHistoryArgs(["1"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        limit: 10
      }
    });
  });

  it("parses own history with custom limit", () => {
    expect(parseHistoryArgs(["1", "5"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        limit: 5
      }
    });
  });

  it("parses another user history with custom limit", () => {
    expect(parseHistoryArgs(["1", "123456789", "5"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        userRef: {
          kind: "telegram_id",
          telegramId: 123456789n
        },
        limit: 5
      }
    });
  });

  it("rejects too large history limit", () => {
    expect(parseHistoryArgs(["1", "31"])).toMatchObject({
      ok: false
    });
  });
});
