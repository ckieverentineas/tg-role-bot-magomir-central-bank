import { LIMIT_PERIOD_KIND, type LimitPeriodKind } from "../../domain/limits/limitPeriodKind.js";

export type LimitPeriodInput = {
  periodKind: LimitPeriodKind;
  periodSeconds: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const DURATION_UNITS_SECONDS: Readonly<Record<string, number>> = {
  s: 1,
  sec: 1,
  second: 1,
  seconds: 1,
  m: 60,
  min: 60,
  minute: 60,
  minutes: 60,
  h: 60 * 60,
  hour: 60 * 60,
  hours: 60 * 60,
  d: 24 * 60 * 60,
  day: 24 * 60 * 60,
  days: 24 * 60 * 60,
  w: 7 * 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
  weeks: 7 * 24 * 60 * 60,
  mo: 30 * 24 * 60 * 60,
  month: 30 * 24 * 60 * 60,
  months: 30 * 24 * 60 * 60
};

export function parseLimitPeriodToken(token: string | undefined, now = new Date()): ParseResult<LimitPeriodInput> {
  const normalized = token?.trim().toLowerCase();

  if (!normalized) {
    return {
      ok: false,
      message: "Укажите период: unlimited, day, week, month, 10d, until:2026-07-01 или 2026-06-01..2026-07-01."
    };
  }

  if (isUnlimitedAlias(normalized)) {
    return ok(createPeriod(LIMIT_PERIOD_KIND.UNLIMITED));
  }

  if (isDayAlias(normalized)) {
    return ok(createPeriod(LIMIT_PERIOD_KIND.DAY));
  }

  if (isWeekAlias(normalized)) {
    return ok(createPeriod(LIMIT_PERIOD_KIND.WEEK));
  }

  if (isMonthAlias(normalized)) {
    return ok(createPeriod(LIMIT_PERIOD_KIND.MONTH));
  }

  const fixedRange = parseFixedRange(normalized);
  if (fixedRange) {
    return fixedRange;
  }

  const untilDate = parseUntilDate(normalized, now);
  if (untilDate) {
    return untilDate;
  }

  const customDuration = parseCustomDuration(normalized);
  if (customDuration) {
    return customDuration;
  }

  return {
    ok: false,
    message: "Период не распознан. Примеры: unlimited, week, month, 14d, until:2026-07-01."
  };
}

export function parseOptionalLimitToken(token: string | undefined): ParseResult<number | undefined> {
  if (token === undefined) {
    return {
      ok: false,
      message: "Укажите периодический лимит или none."
    };
  }

  if (isNoneAlias(token.trim().toLowerCase())) {
    return ok(undefined);
  }

  return parsePositiveNumber(token, "Периодический лимит должен быть положительным числом или none.");
}

export function parsePositiveNumber(token: string | undefined, message: string): ParseResult<number> {
  if (token === undefined || token.trim() === "") {
    return { ok: false, message };
  }

  const value = Number(token.replace(",", "."));

  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message };
  }

  return ok(value);
}

export function parseNonNegativeNumber(token: string | undefined, message: string): ParseResult<number> {
  if (token === undefined || token.trim() === "") {
    return { ok: false, message };
  }

  const value = Number(token.replace(",", "."));

  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, message };
  }

  return ok(value);
}

export function parsePositiveInteger(token: string | undefined, message: string): ParseResult<number> {
  if (token === undefined || !/^\d+$/.test(token)) {
    return { ok: false, message };
  }

  const value = Number(token);

  if (!Number.isSafeInteger(value) || value <= 0) {
    return { ok: false, message };
  }

  return ok(value);
}

function parseFixedRange(token: string): ParseResult<LimitPeriodInput> | null {
  if (!token.includes("..")) {
    return null;
  }

  const [startToken, endToken] = token.split("..");
  const startsAt = parseDateOnly(startToken);
  const endsAt = parseDateOnly(endToken);

  if (!startsAt || !endsAt || startsAt >= endsAt) {
    return {
      ok: false,
      message: "Фиксированный период должен быть в формате 2026-06-01..2026-07-01, дата начала раньше даты конца."
    };
  }

  return ok({
    periodKind: LIMIT_PERIOD_KIND.CUSTOM,
    periodSeconds: null,
    startsAt,
    endsAt
  });
}

function parseUntilDate(token: string, now: Date): ParseResult<LimitPeriodInput> | null {
  const dateToken = token.startsWith("until:") ? token.slice("until:".length) : null;

  if (!dateToken) {
    return null;
  }

  const endsAt = parseDateOnly(dateToken);

  if (!endsAt || endsAt <= now) {
    return {
      ok: false,
      message: "Дата окончания должна быть будущей датой в формате until:2026-07-01."
    };
  }

  return ok({
    periodKind: LIMIT_PERIOD_KIND.CUSTOM,
    periodSeconds: null,
    startsAt: now,
    endsAt
  });
}

function parseCustomDuration(token: string): ParseResult<LimitPeriodInput> | null {
  const match = /^(\d+)([a-z]+)$/.exec(token);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const unitSeconds = unit ? DURATION_UNITS_SECONDS[unit] : undefined;

  if (!Number.isSafeInteger(amount) || amount <= 0 || unitSeconds === undefined) {
    return {
      ok: false,
      message: "Произвольный период должен быть положительной длительностью: 10d, 2w, 3month."
    };
  }

  const periodSeconds = amount * unitSeconds;

  if (!Number.isSafeInteger(periodSeconds)) {
    return {
      ok: false,
      message: "Период слишком большой."
    };
  }

  return ok(createPeriod(LIMIT_PERIOD_KIND.CUSTOM, periodSeconds));
}

function parseDateOnly(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function createPeriod(periodKind: LimitPeriodKind, periodSeconds: number | null = null): LimitPeriodInput {
  return {
    periodKind,
    periodSeconds,
    startsAt: null,
    endsAt: null
  };
}

function isUnlimitedAlias(value: string): boolean {
  return ["unlimited", "forever", "always", "none", "no", "бессрочно", "безлимит"].includes(value);
}

function isNoneAlias(value: string): boolean {
  return ["none", "no", "-", "null", "без", "нет"].includes(value);
}

function isDayAlias(value: string): boolean {
  return ["day", "daily", "день", "сутки"].includes(value);
}

function isWeekAlias(value: string): boolean {
  return ["week", "weekly", "неделя", "неделю"].includes(value);
}

function isMonthAlias(value: string): boolean {
  return ["month", "monthly", "месяц"].includes(value);
}

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}
