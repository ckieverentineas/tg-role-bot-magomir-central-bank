export const LOG_EVENT_TYPES = [
  "finance",
  "progression",
  "purchase",
  "admin",
  "security",
  "system"
] as const;

export type PublicLogEventType = (typeof LOG_EVENT_TYPES)[number];

export function isPublicLogEventType(value: string): value is PublicLogEventType {
  return LOG_EVENT_TYPES.includes(value as PublicLogEventType);
}

export const LOG_EVENT_TYPE = {
  FINANCE: "FINANCE",
  PROGRESSION: "PROGRESSION",
  PURCHASE: "PURCHASE",
  ADMIN: "ADMIN",
  SECURITY: "SECURITY",
  SYSTEM: "SYSTEM"
} as const;

export type LogEventType = (typeof LOG_EVENT_TYPE)[keyof typeof LOG_EVENT_TYPE];

export function isLogEventType(value: string): value is LogEventType {
  return Object.values(LOG_EVENT_TYPE).includes(value as LogEventType);
}

export function parseLogEventType(value: string): LogEventType {
  if (isLogEventType(value)) {
    return value;
  }

  throw new Error(`Unsupported log event type: ${value}`);
}
