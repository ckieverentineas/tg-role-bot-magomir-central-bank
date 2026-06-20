import type { PrismaClient } from "@prisma/client";
import { toMoneyNumber } from "../../domain/money/money.js";

export type ProfileView = {
  id: number;
  telegramId: bigint;
  username: string | null;
  displayName: string;
  alliances: {
    allianceId: number;
    allianceName: string;
    role: string;
  }[];
};

export type BalanceListView = {
  userDisplayName: string;
  allianceName: string;
  balances: {
    currencyId: number;
    currencyName: string;
    currencySymbol: string;
    amount: number;
  }[];
};

export type AllianceInfoView = {
  id: number;
  slug: string;
  name: string;
  currencies: {
    id: number;
    name: string;
    symbol: string;
  }[];
  shops: {
    id: number;
    name: string;
  }[];
  membersCount: number;
};

export type ShopItemsView = {
  shopId: number;
  shopName: string;
  items: {
    id: number;
    name: string;
    price: number;
    currencySymbol: string;
    stock: number | null;
  }[];
};

export type InventoryView = {
  userDisplayName: string;
  items: {
    id: number;
    name: string;
    quantity: number;
    createdAt: Date;
  }[];
};

type AccountQueryDatabase = Pick<
  PrismaClient,
  "user" | "alliance" | "balance" | "shop" | "inventoryItem"
>;

export class AccountQueryService {
  public constructor(private readonly db: AccountQueryDatabase) {}

  public async getProfile(telegramId: bigint): Promise<ProfileView | null> {
    const user = await this.db.user.findUnique({
      where: {
        telegramId
      },
      select: {
        id: true,
        telegramId: true,
        username: true,
        displayName: true,
        memberships: {
          select: {
            allianceId: true,
            role: true,
            alliance: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            allianceId: "asc"
          }
        }
      }
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      displayName: user.displayName,
      alliances: user.memberships.map((membership) => ({
        allianceId: membership.allianceId,
        allianceName: membership.alliance.name,
        role: membership.role
      }))
    };
  }

  public async getBalances(allianceId: number, telegramId: bigint): Promise<BalanceListView | null> {
    const user = await this.db.user.findUnique({
      where: {
        telegramId
      },
      select: {
        id: true,
        displayName: true
      }
    });

    if (!user) {
      return null;
    }

    const alliance = await this.db.alliance.findUnique({
      where: {
        id: allianceId
      },
      select: {
        name: true,
        currencies: {
          select: {
            id: true,
            name: true,
            symbol: true,
            balances: {
              where: {
                userId: user.id
              },
              select: {
                amount: true
              }
            }
          },
          orderBy: {
            sortOrder: "asc"
          }
        }
      }
    });

    if (!alliance) {
      return null;
    }

    return {
      userDisplayName: user.displayName,
      allianceName: alliance.name,
      balances: alliance.currencies.map((currency) => ({
        currencyId: currency.id,
        currencyName: currency.name,
        currencySymbol: currency.symbol,
        amount: currency.balances[0] ? toMoneyNumber(currency.balances[0].amount) : 0
      }))
    };
  }

  public async getAllianceInfo(allianceId: number): Promise<AllianceInfoView | null> {
    const alliance = await this.db.alliance.findUnique({
      where: {
        id: allianceId
      },
      select: {
        id: true,
        slug: true,
        name: true,
        currencies: {
          select: {
            id: true,
            name: true,
            symbol: true
          },
          orderBy: {
            sortOrder: "asc"
          }
        },
        shops: {
          where: {
            isHidden: false
          },
          select: {
            id: true,
            name: true
          },
          orderBy: {
            id: "asc"
          }
        },
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    if (!alliance) {
      return null;
    }

    return {
      id: alliance.id,
      slug: alliance.slug,
      name: alliance.name,
      currencies: alliance.currencies,
      shops: alliance.shops,
      membersCount: alliance._count.members
    };
  }

  public async getShopItems(shopId: number): Promise<ShopItemsView | null> {
    const shop = await this.db.shop.findUnique({
      where: {
        id: shopId
      },
      select: {
        id: true,
        name: true,
        items: {
          where: {
            isHidden: false
          },
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            currency: {
              select: {
                symbol: true
              }
            }
          },
          orderBy: {
            name: "asc"
          }
        }
      }
    });

    if (!shop) {
      return null;
    }

    return {
      shopId: shop.id,
      shopName: shop.name,
      items: shop.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: toMoneyNumber(item.price),
        currencySymbol: item.currency.symbol,
        stock: item.stock
      }))
    };
  }

  public async getInventory(telegramId: bigint): Promise<InventoryView | null> {
    const user = await this.db.user.findUnique({
      where: {
        telegramId
      },
      select: {
        id: true,
        displayName: true,
        inventory: {
          select: {
            id: true,
            quantity: true,
            createdAt: true,
            item: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!user) {
      return null;
    }

    return {
      userDisplayName: user.displayName,
      items: user.inventory.map((inventoryItem) => ({
        id: inventoryItem.id,
        name: inventoryItem.item.name,
        quantity: inventoryItem.quantity,
        createdAt: inventoryItem.createdAt
      }))
    };
  }
}
