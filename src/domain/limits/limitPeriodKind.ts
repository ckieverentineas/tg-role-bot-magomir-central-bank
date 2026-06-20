export const LIMIT_PERIOD_KIND = {
  UNLIMITED: "UNLIMITED",
  DAY: "DAY",
  WEEK: "WEEK",
  MONTH: "MONTH",
  CUSTOM: "CUSTOM"
} as const;

export type LimitPeriodKind = (typeof LIMIT_PERIOD_KIND)[keyof typeof LIMIT_PERIOD_KIND];

export function isLimitPeriodKind(value: string): value is LimitPeriodKind {
  return Object.values(LIMIT_PERIOD_KIND).includes(value as LimitPeriodKind);
}

export function parseLimitPeriodKind(value: string): LimitPeriodKind {
  if (isLimitPeriodKind(value)) {
    return value;
  }

  throw new Error(`Unsupported limit period kind: ${value}`);
}
