import { describe, expect, it } from "vitest";
import { LIMIT_PERIOD_KIND } from "../../src/domain/limits/limitPeriodKind.js";
import { parseLimitPeriodToken, parseOptionalLimitToken } from "../../src/application/limits/limitPeriodInput.js";

describe("parseLimitPeriodToken", () => {
  const now = new Date("2026-06-21T00:00:00.000Z");

  it("parses unlimited and named rolling periods", () => {
    expect(parseLimitPeriodToken("unlimited", now)).toEqual({
      ok: true,
      value: {
        periodKind: LIMIT_PERIOD_KIND.UNLIMITED,
        periodSeconds: null,
        startsAt: null,
        endsAt: null
      }
    });

    expect(parseLimitPeriodToken("week", now)).toEqual({
      ok: true,
      value: {
        periodKind: LIMIT_PERIOD_KIND.WEEK,
        periodSeconds: null,
        startsAt: null,
        endsAt: null
      }
    });
  });

  it("parses custom durations", () => {
    expect(parseLimitPeriodToken("14d", now)).toEqual({
      ok: true,
      value: {
        periodKind: LIMIT_PERIOD_KIND.CUSTOM,
        periodSeconds: 14 * 24 * 60 * 60,
        startsAt: null,
        endsAt: null
      }
    });
  });

  it("parses fixed ranges", () => {
    expect(parseLimitPeriodToken("2026-06-21..2026-07-21", now)).toEqual({
      ok: true,
      value: {
        periodKind: LIMIT_PERIOD_KIND.CUSTOM,
        periodSeconds: null,
        startsAt: new Date("2026-06-21T00:00:00.000Z"),
        endsAt: new Date("2026-07-21T00:00:00.000Z")
      }
    });
  });

  it("rejects invalid fixed ranges", () => {
    expect(parseLimitPeriodToken("2026-07-21..2026-06-21", now)).toMatchObject({
      ok: false
    });
  });
});

describe("parseOptionalLimitToken", () => {
  it("parses none aliases and positive numbers", () => {
    expect(parseOptionalLimitToken("none")).toEqual({
      ok: true,
      value: undefined
    });

    expect(parseOptionalLimitToken("100")).toEqual({
      ok: true,
      value: 100
    });
  });
});
