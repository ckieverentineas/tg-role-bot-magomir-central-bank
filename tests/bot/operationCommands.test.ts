import { describe, expect, it } from "vitest";
import { parseBuyArgs, parseSbpTransferArgs } from "../../src/bot/commands/operationCommands.js";

describe("parseSbpTransferArgs", () => {
  it("parses transfer by Telegram ID", () => {
    expect(parseSbpTransferArgs(["1", "2", "123456789", "50", "за", "квест"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        currencyId: 2,
        receiver: {
          kind: "telegram_id",
          telegramId: 123456789n
        },
        amount: 50,
        comment: "за квест"
      }
    });
  });

  it("parses reply receiver", () => {
    expect(parseSbpTransferArgs(["1", "2", "reply", "50"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        currencyId: 2,
        receiver: {
          kind: "reply"
        },
        amount: 50
      }
    });
  });

  it("rejects invalid receiver token", () => {
    expect(parseSbpTransferArgs(["1", "2", "@name", "50"])).toMatchObject({
      ok: false
    });
  });
});

describe("parseBuyArgs", () => {
  it("parses item and quantity", () => {
    expect(parseBuyArgs(["10", "3"])).toEqual({
      ok: true,
      value: {
        itemId: 10,
        quantity: 3
      }
    });
  });

  it("rejects non-integer quantity", () => {
    expect(parseBuyArgs(["10", "1.5"])).toMatchObject({
      ok: false
    });
  });
});
