import type { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../../config/env.js";
import { BANK_ROLE } from "../../domain/users/bankRole.js";

type AuthorizationDatabase = Pick<PrismaClient, "allianceMember" | "shop" | "shopItem">;

export class AuthorizationService {
  public constructor(
    private readonly db: AuthorizationDatabase,
    private readonly config: AppConfig
  ) {}

  public isGlobalAdmin(telegramId: bigint | undefined): boolean {
    if (telegramId === undefined) {
      return false;
    }

    return this.config.adminTelegramIds.some((adminId) => adminId === telegramId);
  }

  public async canManageAlliance(telegramId: bigint | undefined, allianceId: number): Promise<boolean> {
    if (this.isGlobalAdmin(telegramId)) {
      return true;
    }

    if (telegramId === undefined) {
      return false;
    }

    const membership = await this.db.allianceMember.findFirst({
      where: {
        allianceId,
        role: {
          in: [BANK_ROLE.BANK_ADMIN, BANK_ROLE.SUPER_ADMIN]
        },
        user: {
          telegramId
        }
      },
      select: {
        id: true
      }
    });

    return membership !== null;
  }

  public async canManageShop(telegramId: bigint | undefined, shopId: number): Promise<boolean> {
    const shop = await this.db.shop.findUnique({
      where: {
        id: shopId
      },
      select: {
        allianceId: true
      }
    });

    if (!shop) {
      return false;
    }

    return this.canManageAlliance(telegramId, shop.allianceId);
  }

  public async canManageShopItem(telegramId: bigint | undefined, itemId: number): Promise<boolean> {
    const item = await this.db.shopItem.findUnique({
      where: {
        id: itemId
      },
      select: {
        shop: {
          select: {
            allianceId: true
          }
        }
      }
    });

    if (!item) {
      return false;
    }

    return this.canManageAlliance(telegramId, item.shop.allianceId);
  }
}
