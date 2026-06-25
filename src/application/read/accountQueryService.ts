import type { PrismaClient } from "@prisma/client";
import { toMoneyNumber } from "../../domain/money/money.js";

export type ProfileView = {
  id: number;
  telegramId: bigint;
  username: string | null;
  displayName: string;
  characterName: string | null;
  className: string | null;
  spec: string | null;
  activeAlliance: {
    id: number;
    name: string;
  } | null;
  alliances: {
    allianceId: number;
    allianceName: string;
    role: string;
    className: string | null;
    spec: string | null;
    faculty: {
      id: number;
      name: string;
      symbol: string;
    } | null;
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
  faculties: {
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

export type TransferHistoryView = {
  userDisplayName: string;
  allianceName: string;
  transfers: {
    id: number;
    direction: "incoming" | "outgoing";
    amount: number;
    currencySymbol: string;
    counterpartyDisplayName: string;
    status: string;
    comment: string | null;
    createdAt: Date;
  }[];
};

export type PurchaseHistoryView = {
  userDisplayName: string;
  allianceName: string;
  purchases: {
    id: number;
    itemName: string;
    quantity: number;
    totalPrice: number;
    currencySymbol: string;
    status: string;
    createdAt: Date;
  }[];
};

type AccountQueryDatabase = Pick<
  PrismaClient,
  "user" | "alliance" | "balance" | "shop" | "inventoryItem" | "sbpTransfer" | "shopPurchase"
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
        characterName: true,
        className: true,
        spec: true,
        activeAlliance: {
          select: {
            id: true,
            name: true
          }
        },
        memberships: {
          select: {
            allianceId: true,
            role: true,
            className: true,
            spec: true,
            faculty: {
              select: {
                id: true,
                name: true,
                symbol: true
              }
            },
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
      characterName: user.characterName,
      className: user.className,
      spec: user.spec,
      activeAlliance: user.activeAlliance,
      alliances: user.memberships.map((membership) => ({
        allianceId: membership.allianceId,
        allianceName: membership.alliance.name,
        role: membership.role,
        className: membership.className,
        spec: membership.spec,
        faculty: membership.faculty
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
        displayName: true,
        characterName: true
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
      userDisplayName: formatUserName(user),
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
        faculties: {
          where: {
            isHidden: false
          },
          select: {
            id: true,
            name: true,
            symbol: true
          },
          orderBy: [
            {
              sortOrder: "asc"
            },
            {
              id: "asc"
            }
          ]
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
      faculties: alliance.faculties,
      shops: alliance.shops,
      membersCount: alliance._count.members
    };
  }

  public async getShopItems(shopId: number, allianceId?: number): Promise<ShopItemsView | null> {
    const shop = await this.db.shop.findFirst({
      where: {
        id: shopId,
        isHidden: false,
        ...(allianceId !== undefined ? { allianceId } : {})
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
        characterName: true,
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
      userDisplayName: formatUserName(user),
      items: user.inventory.map((inventoryItem) => ({
        id: inventoryItem.id,
        name: inventoryItem.item.name,
        quantity: inventoryItem.quantity,
        createdAt: inventoryItem.createdAt
      }))
    };
  }

  public async getTransferHistory(
    allianceId: number,
    telegramId: bigint,
    limit: number
  ): Promise<TransferHistoryView | null> {
    const context = await this.getUserAndAlliance(allianceId, telegramId);
    if (!context) {
      return null;
    }

    const transfers = await this.db.sbpTransfer.findMany({
      where: {
        allianceId,
        OR: [
          { senderUserId: context.userId },
          { receiverUserId: context.userId }
        ]
      },
      select: {
        id: true,
        senderUserId: true,
        receiverUserId: true,
        amount: true,
        status: true,
        comment: true,
        createdAt: true,
        currency: {
          select: {
            symbol: true
          }
        },
        sender: {
          select: {
            displayName: true,
            characterName: true
          }
        },
        receiver: {
          select: {
            displayName: true,
            characterName: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });

    return {
      userDisplayName: context.userDisplayName,
      allianceName: context.allianceName,
      transfers: transfers.map((transfer) => {
        const isOutgoing = transfer.senderUserId === context.userId;

        return {
          id: transfer.id,
          direction: isOutgoing ? "outgoing" : "incoming",
          amount: toMoneyNumber(transfer.amount),
          currencySymbol: transfer.currency.symbol,
          counterpartyDisplayName: isOutgoing ? formatUserName(transfer.receiver) : formatUserName(transfer.sender),
          status: transfer.status,
          comment: transfer.comment,
          createdAt: transfer.createdAt
        };
      })
    };
  }

  public async getPurchaseHistory(
    allianceId: number,
    telegramId: bigint,
    limit: number
  ): Promise<PurchaseHistoryView | null> {
    const context = await this.getUserAndAlliance(allianceId, telegramId);
    if (!context) {
      return null;
    }

    const purchases = await this.db.shopPurchase.findMany({
      where: {
        userId: context.userId,
        item: {
          shop: {
            allianceId
          }
        }
      },
      select: {
        id: true,
        quantity: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        item: {
          select: {
            name: true,
            currency: {
              select: {
                symbol: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });

    return {
      userDisplayName: context.userDisplayName,
      allianceName: context.allianceName,
      purchases: purchases.map((purchase) => ({
        id: purchase.id,
        itemName: purchase.item.name,
        quantity: purchase.quantity,
        totalPrice: toMoneyNumber(purchase.totalPrice),
        currencySymbol: purchase.item.currency.symbol,
        status: purchase.status,
        createdAt: purchase.createdAt
      }))
    };
  }

  private async getUserAndAlliance(
    allianceId: number,
    telegramId: bigint
  ): Promise<{ userId: number; userDisplayName: string; allianceName: string } | null> {
    const [user, alliance] = await Promise.all([
      this.db.user.findUnique({
        where: {
          telegramId
        },
        select: {
          id: true,
          displayName: true,
          characterName: true
        }
      }),
      this.db.alliance.findUnique({
        where: {
          id: allianceId
        },
        select: {
          name: true
        }
      })
    ]);

    if (!user || !alliance) {
      return null;
    }

    return {
      userId: user.id,
      userDisplayName: formatUserName(user),
      allianceName: alliance.name
    };
  }
}

function formatUserName(user: { displayName: string; characterName: string | null }): string {
  return user.characterName ?? user.displayName;
}
