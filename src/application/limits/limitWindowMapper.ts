import { LIMIT_PERIOD_KIND, type LimitPeriodKind } from "../../domain/limits/limitPeriodKind.js";
import type { LimitWindow } from "../../domain/limits/limitPolicy.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

export type LimitPeriodConfig = {
  periodKind: LimitPeriodKind;
  periodSeconds: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export function mapLimitWindow(config: LimitPeriodConfig): LimitWindow {
  if (config.endsAt) {
    return config.startsAt
      ? { kind: "fixed", startsAt: config.startsAt, endsAt: config.endsAt }
      : { kind: "fixed", endsAt: config.endsAt };
  }

  switch (config.periodKind) {
    case LIMIT_PERIOD_KIND.DAY:
      return { kind: "rolling", durationMs: DAY_MS };
    case LIMIT_PERIOD_KIND.WEEK:
      return { kind: "rolling", durationMs: WEEK_MS };
    case LIMIT_PERIOD_KIND.MONTH:
      return { kind: "rolling", durationMs: MONTH_MS };
    case LIMIT_PERIOD_KIND.CUSTOM:
      return { kind: "rolling", durationMs: (config.periodSeconds ?? 0) * 1000 };
    case LIMIT_PERIOD_KIND.UNLIMITED:
      return { kind: "unlimited" };
  }
}
