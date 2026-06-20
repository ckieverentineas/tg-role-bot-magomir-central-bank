export const LOG_TARGET_SCOPE = {
  LOCAL: "LOCAL",
  SUPERADMIN_MIRROR: "SUPERADMIN_MIRROR"
} as const;

export type LogTargetScope = (typeof LOG_TARGET_SCOPE)[keyof typeof LOG_TARGET_SCOPE];
