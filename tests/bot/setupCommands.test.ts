import { describe, expect, it } from "vitest";
import { BANK_ROLE } from "../../src/domain/users/bankRole.js";
import {
  parseAddMemberArgs,
  parseCreateAllianceArgs,
  parseCreateCurrencyArgs,
  parseCreateShopArgs,
  parseCreateShopItemArgs,
  parseShopItemVisibilityArgs,
  parseShopVisibilityArgs,
  parseSetBalanceArgs
} from "../../src/bot/commands/setupCommands.js";

describe("setup command parsers", () => {
  it("parses alliance creation with current chat id", () => {
    expect(parseCreateAllianceArgs(["avalon", "Avalon", "Bank"], -100123)).toEqual({
      ok: true,
      value: {
        slug: "avalon",
        name: "Avalon Bank",
        telegramChatId: -100123n
      }
    });
  });

  it("parses currency creation", () => {
    expect(parseCreateCurrencyArgs(["1", "G", "Gold"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        symbol: "G",
        name: "Gold"
      }
    });
  });

  it("parses member creation by reply", () => {
    expect(parseAddMemberArgs(["1", "reply", "bank_admin"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        userRef: {
          kind: "reply"
        },
        role: BANK_ROLE.BANK_ADMIN
      }
    });
  });

  it("parses balance setup", () => {
    expect(parseSetBalanceArgs(["1", "2", "123456789", "250.5"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        currencyId: 2,
        userRef: {
          kind: "telegram_id",
          telegramId: 123456789n
        },
        amount: 250.5
      }
    });
  });

  it("parses shop creation", () => {
    expect(parseCreateShopArgs(["1", "Main", "Shop"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        name: "Main Shop"
      }
    });
  });

  it("parses item creation with stock", () => {
    expect(parseCreateShopItemArgs(["1", "2", "10", "5", "Magic", "Book"])).toEqual({
      ok: true,
      value: {
        shopId: 1,
        currencyId: 2,
        price: 10,
        stock: 5,
        name: "Magic Book"
      }
    });
  });

  it("parses item creation without stock", () => {
    expect(parseCreateShopItemArgs(["1", "2", "10", "none", "Magic", "Book"])).toEqual({
      ok: true,
      value: {
        shopId: 1,
        currencyId: 2,
        price: 10,
        name: "Magic Book"
      }
    });
  });

  it("parses shop visibility commands", () => {
    expect(parseShopVisibilityArgs(["5"])).toEqual({
      ok: true,
      value: {
        shopId: 5
      }
    });
  });

  it("parses item visibility commands", () => {
    expect(parseShopItemVisibilityArgs(["7"])).toEqual({
      ok: true,
      value: {
        itemId: 7
      }
    });
  });
});
