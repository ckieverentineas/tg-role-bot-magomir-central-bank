import { describe, expect, it } from "vitest";
import { LIMIT_PERIOD_KIND } from "../../src/domain/limits/limitPeriodKind.js";
import { parseSetSbpLimitArgs, parseSetShopItemLimitArgs } from "../../src/bot/commands/limitCommands.js";

describe("parseSetSbpLimitArgs", () => {
  const now = new Date("2026-06-21T00:00:00.000Z");

  it("parses alliance-wide transfer limits", () => {
    expect(parseSetSbpLimitArgs(["1", "all", "0", "100", "500", "week"], now)).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        minAmount: 0,
        maxAmount: 100,
        periodAmountLimit: 500,
        period: {
          periodKind: LIMIT_PERIOD_KIND.WEEK,
          periodSeconds: null,
          startsAt: null,
          endsAt: null
        }
      }
    });
  });

  it("rejects period amount limits below the max transfer amount", () => {
    expect(parseSetSbpLimitArgs(["1", "2", "0", "100", "50", "week"], now)).toMatchObject({
      ok: false
    });
  });
});

describe("parseSetShopItemLimitArgs", () => {
  const now = new Date("2026-06-21T00:00:00.000Z");

  it("parses item purchase limits with custom duration", () => {
    expect(parseSetShopItemLimitArgs(["10", "1", "3", "6", "14d"], now)).toEqual({
      ok: true,
      value: {
        itemId: 10,
        minQuantity: 1,
        maxQuantityPerPurchase: 3,
        periodQuantityLimit: 6,
        period: {
          periodKind: LIMIT_PERIOD_KIND.CUSTOM,
          periodSeconds: 14 * 24 * 60 * 60,
          startsAt: null,
          endsAt: null
        }
      }
    });
  });

  it("allows item limits without period totals", () => {
    expect(parseSetShopItemLimitArgs(["10", "1", "3", "none", "unlimited"], now)).toEqual({
      ok: true,
      value: {
        itemId: 10,
        minQuantity: 1,
        maxQuantityPerPurchase: 3,
        period: {
          periodKind: LIMIT_PERIOD_KIND.UNLIMITED,
          periodSeconds: null,
          startsAt: null,
          endsAt: null
        }
      }
    });
  });

  it("rejects period quantity limits below the max purchase quantity", () => {
    expect(parseSetShopItemLimitArgs(["10", "1", "3", "2", "week"], now)).toMatchObject({
      ok: false
    });
  });
});
