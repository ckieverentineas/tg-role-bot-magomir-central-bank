import { describe, expect, it } from "vitest";
import { checkRangedLimit, type RangedLimitPolicy } from "../../src/domain/limits/limitPolicy.js";

describe("checkRangedLimit", () => {
  const now = new Date("2026-06-21T10:00:00.000Z");

  it("rejects values outside the allowed range", () => {
    const policy: RangedLimitPolicy = {
      minValue: 10,
      maxValue: 100,
      window: { kind: "unlimited" }
    };

    expect(checkRangedLimit(policy, 9, [], now)).toMatchObject({
      allowed: false,
      reason: "VALUE_BELOW_MIN"
    });

    expect(checkRangedLimit(policy, 101, [], now)).toMatchObject({
      allowed: false,
      reason: "VALUE_ABOVE_MAX"
    });
  });

  it("uses only entries from the rolling period", () => {
    const policy: RangedLimitPolicy = {
      minValue: 1,
      maxValue: 50,
      periodLimit: 100,
      window: { kind: "rolling", durationMs: 7 * 24 * 60 * 60 * 1000 }
    };

    const result = checkRangedLimit(
      policy,
      50,
      [
        { value: 40, occurredAt: new Date("2026-06-20T10:00:00.000Z") },
        { value: 70, occurredAt: new Date("2026-06-01T10:00:00.000Z") }
      ],
      now
    );

    expect(result).toEqual({
      allowed: true,
      usedInPeriod: 40,
      remainingInPeriod: 10
    });
  });

  it("rejects requests above the period limit", () => {
    const policy: RangedLimitPolicy = {
      minValue: 1,
      maxValue: 100,
      periodLimit: 100,
      window: { kind: "unlimited" }
    };

    expect(
      checkRangedLimit(
        policy,
        30,
        [
          { value: 50, occurredAt: new Date("2026-05-01T10:00:00.000Z") },
          { value: 30, occurredAt: new Date("2026-06-01T10:00:00.000Z") }
        ],
        now
      )
    ).toMatchObject({
      allowed: false,
      reason: "PERIOD_LIMIT_EXCEEDED",
      usedInPeriod: 80,
      remainingInPeriod: 20
    });
  });

  it("rejects expired fixed windows", () => {
    const policy: RangedLimitPolicy = {
      minValue: 1,
      maxValue: 100,
      periodLimit: 100,
      window: {
        kind: "fixed",
        startsAt: new Date("2026-06-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-10T00:00:00.000Z")
      }
    };

    expect(checkRangedLimit(policy, 10, [], now)).toMatchObject({
      allowed: false,
      reason: "WINDOW_EXPIRED"
    });
  });
});
