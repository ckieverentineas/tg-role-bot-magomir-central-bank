import type { Prisma, PrismaClient } from "@prisma/client";
import { BANK_ROLE, type BankRole } from "../../domain/users/bankRole.js";
import type { TelegramUserProfile } from "../users/telegramUserService.js";

const allianceSelect = {
  id: true,
  slug: true,
  name: true,
  telegramChatId: true
} satisfies Prisma.AllianceSelect;

const currencySelect = {
  id: true,
  allianceId: true,
  name: true,
  symbol: true,
  isTransferEnabled: true
} satisfies Prisma.CurrencySelect;

const memberSelect = {
  id: true,
  allianceId: true,
  role: true,
  user: {
    select: {
      id: true,
      telegramId: true,
      displayName: true
    }
  }
} satisfies Prisma.AllianceMemberSelect;

const balanceSelect = {
  userId: true,
  currencyId: true,
  amount: true,
  user: {
    select: {
      displayName: true
    }
  },
  currency: {
    select: {
      symbol: true
    }
  }
} satisfies Prisma.BalanceSelect;

const shopSelect = {
  id: true,
  allianceId: true,
  name: true
} satisfies Prisma.ShopSelect;

const shopItemSelect = {
  id: true,
  shopId: true,
  currencyId: true,
  name: true,
  price: true,
  stock: true
} satisfies Prisma.ShopItemSelect;

export type AllianceView = Prisma.AllianceGetPayload<{ select: typeof allianceSelect }>;
export type CurrencyView = Prisma.CurrencyGetPayload<{ select: typeof currencySelect }>;
export type MemberView = Prisma.AllianceMemberGetPayload<{ select: typeof memberSelect }>;
export type BalanceView = Prisma.BalanceGetPayload<{ select: typeof balanceSelect }>;
export type ShopView = Prisma.ShopGetPayload<{ select: typeof shopSelect }>;
export type ShopItemView = Prisma.ShopItemGetPayload<{ select: typeof shopItemSelect }>;

export type CreateAllianceInput = {
  slug: string;
  name: string;
  telegramChatId?: bigint;
};

export type CreateCurrencyInput = {
  allianceId: number;
  name: string;
  symbol: string;
  isTransferEnabled?: boolean;
};

export type AddMemberInput = {
  allianceId: number;
  user: TelegramUserProfile;
  role?: BankRole;
};

export type SetBalanceInput = {
  allianceId: number;
  currencyId: number;
  user: TelegramUserProfile;
  amount: number;
};

export type CreateShopInput = {
  allianceId: number;
  name: string;
};

export type CreateShopItemInput = {
  shopId: number;
  currencyId: number;
  name: string;
  price: number;
  stock?: number;
};

export class AdminSetupService {
  public constructor(private readonly db: PrismaClient) {}

  public async createAlliance(input: CreateAllianceInput): Promise<AllianceView> {
    validateSlug(input.slug);
    const name = normalizeRequiredText(input.name, "Alliance name is required.");

    return this.db.alliance.upsert({
      where: {
        slug: input.slug
      },
      create: {
        slug: input.slug,
        name,
        telegramChatId: input.telegramChatId ?? null
      },
      update: {
        name,
        telegramChatId: input.telegramChatId ?? null
      },
      select: allianceSelect
    });
  }

  public async createCurrency(input: CreateCurrencyInput): Promise<CurrencyView> {
    const name = normalizeRequiredText(input.name, "Currency name is required.");
    const symbol = normalizeRequiredText(input.symbol, "Currency symbol is required.");

    await this.assertAllianceExists(input.allianceId);

    return this.db.currency.upsert({
      where: {
        allianceId_name: {
          allianceId: input.allianceId,
          name
        }
      },
      create: {
        allianceId: input.allianceId,
        name,
        symbol,
        isTransferEnabled: input.isTransferEnabled ?? true
      },
      update: {
        symbol,
        isTransferEnabled: input.isTransferEnabled ?? true
      },
      select: currencySelect
    });
  }

  public async addMember(input: AddMemberInput): Promise<MemberView> {
    await this.assertAllianceExists(input.allianceId);
    const user = await this.upsertUser(input.user);

    return this.db.allianceMember.upsert({
      where: {
        allianceId_userId: {
          allianceId: input.allianceId,
          userId: user.id
        }
      },
      create: {
        allianceId: input.allianceId,
        userId: user.id,
        role: input.role ?? BANK_ROLE.MEMBER
      },
      update: {
        role: input.role ?? BANK_ROLE.MEMBER
      },
      select: memberSelect
    });
  }

  public async setBalance(input: SetBalanceInput): Promise<BalanceView> {
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      throw new Error("Balance amount must be a non-negative number.");
    }

    const currency = await this.db.currency.findFirst({
      where: {
        id: input.currencyId,
        allianceId: input.allianceId
      },
      select: {
        id: true
      }
    });

    if (!currency) {
      throw new Error(`Currency ${input.currencyId} was not found in alliance ${input.allianceId}.`);
    }

    const member = await this.addMember({
      allianceId: input.allianceId,
      user: input.user
    });

    return this.db.balance.upsert({
      where: {
        userId_currencyId: {
          userId: member.user.id,
          currencyId: input.currencyId
        }
      },
      create: {
        userId: member.user.id,
        currencyId: input.currencyId,
        amount: input.amount
      },
      update: {
        amount: input.amount
      },
      select: balanceSelect
    });
  }

  public async createShop(input: CreateShopInput): Promise<ShopView> {
    const name = normalizeRequiredText(input.name, "Shop name is required.");
    await this.assertAllianceExists(input.allianceId);

    return this.db.shop.upsert({
      where: {
        allianceId_name: {
          allianceId: input.allianceId,
          name
        }
      },
      create: {
        allianceId: input.allianceId,
        name
      },
      update: {
        name,
        isHidden: false
      },
      select: shopSelect
    });
  }

  public async createShopItem(input: CreateShopItemInput): Promise<ShopItemView> {
    if (!Number.isFinite(input.price) || input.price < 0) {
      throw new Error("Item price must be a non-negative number.");
    }

    if (input.stock !== undefined && (!Number.isSafeInteger(input.stock) || input.stock < 0)) {
      throw new Error("Item stock must be a non-negative integer or none.");
    }

    const name = normalizeRequiredText(input.name, "Item name is required.");
    const shop = await this.db.shop.findUnique({
      where: {
        id: input.shopId
      },
      select: {
        id: true,
        allianceId: true
      }
    });

    if (!shop) {
      throw new Error(`Shop ${input.shopId} was not found.`);
    }

    const currency = await this.db.currency.findFirst({
      where: {
        id: input.currencyId,
        allianceId: shop.allianceId
      },
      select: {
        id: true
      }
    });

    if (!currency) {
      throw new Error(`Currency ${input.currencyId} was not found in shop alliance.`);
    }

    return this.db.shopItem.upsert({
      where: {
        shopId_name: {
          shopId: input.shopId,
          name
        }
      },
      create: {
        shopId: input.shopId,
        currencyId: input.currencyId,
        name,
        price: input.price,
        stock: input.stock ?? null
      },
      update: {
        currencyId: input.currencyId,
        price: input.price,
        stock: input.stock ?? null,
        isHidden: false
      },
      select: shopItemSelect
    });
  }

  private async upsertUser(profile: TelegramUserProfile): Promise<{ id: number }> {
    return this.db.user.upsert({
      where: {
        telegramId: profile.telegramId
      },
      create: {
        telegramId: profile.telegramId,
        username: profile.username ?? null,
        displayName: profile.displayName
      },
      update: {
        username: profile.username ?? null,
        displayName: profile.displayName
      },
      select: {
        id: true
      }
    });
  }

  private async assertAllianceExists(allianceId: number): Promise<void> {
    const alliance = await this.db.alliance.findUnique({
      where: {
        id: allianceId
      },
      select: {
        id: true
      }
    });

    if (!alliance) {
      throw new Error(`Alliance ${allianceId} was not found.`);
    }
  }
}

function validateSlug(slug: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(slug)) {
    throw new Error("Alliance slug must contain 2-63 lowercase latin letters, digits, underscores or dashes.");
  }
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(errorMessage);
  }

  return normalized;
}
