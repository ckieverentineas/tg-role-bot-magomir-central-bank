export const BANK_ROLE = {
  MEMBER: "MEMBER",
  BANK_ADMIN: "BANK_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN"
} as const;

export type BankRole = (typeof BANK_ROLE)[keyof typeof BANK_ROLE];

export function parseBankRole(value: string | undefined): BankRole {
  const normalized = value?.trim().toUpperCase();

  switch (normalized) {
    case BANK_ROLE.BANK_ADMIN:
    case "ADMIN":
    case "BANK":
      return BANK_ROLE.BANK_ADMIN;
    case BANK_ROLE.SUPER_ADMIN:
    case "SUPER":
      return BANK_ROLE.SUPER_ADMIN;
    default:
      return BANK_ROLE.MEMBER;
  }
}
