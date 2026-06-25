import type { Bot } from "grammy";
import type { AuthorizationService } from "../../application/auth/authorizationService.js";
import type { AccountQueryService } from "../../application/read/accountQueryService.js";
import { parsePositiveInteger, type ParseResult } from "../../application/limits/limitPeriodInput.js";
import { getTelegramId } from "../middleware/adminOnly.js";
import {
  getTelegramUserProfile,
  parseTelegramUserRef,
  resolveTelegramUserProfile,
  type TelegramUserRef
} from "../telegramProfiles.js";
import type { BotContext } from "../context.js";

const PROFILE_USAGE = "Формат: /profile [telegramId|reply]";
const BALANCE_USAGE = "Формат: /balance <allianceId> [telegramId|reply]";
const ALLIANCE_INFO_USAGE = "Формат: /alliance_info <allianceId>";
const SHOP_USAGE = "Формат: /shop <shopId>";
const INVENTORY_USAGE = "Формат: /inventory [telegramId|reply]";
const HISTORY_USAGE = "Формат: /history <allianceId> [telegramId|reply] [limit]";
const PURCHASE_HISTORY_USAGE = "Формат: /purchase_history <allianceId> [telegramId|reply] [limit]";
const DEFAULT_HISTORY_LIMIT = 10;
const MAX_HISTORY_LIMIT = 30;

export function registerQueryCommands(
  bot: Bot<BotContext>,
  accountQueryService: AccountQueryService,
  authorizationService: AuthorizationService
): void {
  bot.command("profile", async (ctx) => {
    const parsed = parseOptionalUserRefArgs(getCommandArgs(ctx), PROFILE_USAGE);
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const userProfile = parsed.value
      ? resolveTelegramUserProfile(ctx, parsed.value)
      : getOwnProfile(ctx);

    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    if (!authorizationService.canReadUserScopedData(getTelegramId(ctx), userProfile.value.telegramId)) {
      await ctx.reply("Недостаточно прав для просмотра чужого профиля.");
      return;
    }

    const profile = await accountQueryService.getProfile(userProfile.value.telegramId);
    await ctx.reply(profile ? formatProfile(profile) : "Профиль пока не найден.");
  });

  bot.command("balance", async (ctx) => {
    const parsed = parseBalanceArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const userProfile = parsed.value.userRef
      ? resolveTelegramUserProfile(ctx, parsed.value.userRef)
      : getOwnProfile(ctx);

    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    if (!(await authorizationService.canReadAllianceUserData(
      getTelegramId(ctx),
      userProfile.value.telegramId,
      parsed.value.allianceId
    ))) {
      await ctx.reply("Недостаточно прав для просмотра данных этого участника.");
      return;
    }

    const balance = await accountQueryService.getBalances(parsed.value.allianceId, userProfile.value.telegramId);
    await ctx.reply(balance ? formatBalance(balance) : "Баланс не найден.");
  });

  bot.command("alliance_info", async (ctx) => {
    const parsed = parseSinglePositiveIntArgs(getCommandArgs(ctx), ALLIANCE_INFO_USAGE, "allianceId");
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const alliance = await accountQueryService.getAllianceInfo(parsed.value);
    await ctx.reply(alliance ? formatAllianceInfo(alliance) : "Ролевая не найдена.");
  });

  bot.command("shop", async (ctx) => {
    const parsed = parseSinglePositiveIntArgs(getCommandArgs(ctx), SHOP_USAGE, "shopId");
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const shop = await accountQueryService.getShopItems(parsed.value);
    await ctx.reply(shop ? formatShop(shop) : "Магазин не найден.");
  });

  bot.command("inventory", async (ctx) => {
    const parsed = parseOptionalUserRefArgs(getCommandArgs(ctx), INVENTORY_USAGE);
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const userProfile = parsed.value
      ? resolveTelegramUserProfile(ctx, parsed.value)
      : getOwnProfile(ctx);

    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    if (!authorizationService.canReadUserScopedData(getTelegramId(ctx), userProfile.value.telegramId)) {
      await ctx.reply("Недостаточно прав для просмотра чужого инвентаря.");
      return;
    }

    const inventory = await accountQueryService.getInventory(userProfile.value.telegramId);
    await ctx.reply(inventory ? formatInventory(inventory) : "Инвентарь не найден.");
  });

  bot.command("history", async (ctx) => {
    const parsed = parseHistoryArgs(getCommandArgs(ctx), HISTORY_USAGE);
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const userProfile = parsed.value.userRef
      ? resolveTelegramUserProfile(ctx, parsed.value.userRef)
      : getOwnProfile(ctx);

    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    if (!(await authorizationService.canReadAllianceUserData(
      getTelegramId(ctx),
      userProfile.value.telegramId,
      parsed.value.allianceId
    ))) {
      await ctx.reply("Недостаточно прав для просмотра истории этого участника.");
      return;
    }

    const history = await accountQueryService.getTransferHistory(
      parsed.value.allianceId,
      userProfile.value.telegramId,
      parsed.value.limit
    );
    await ctx.reply(history ? formatTransferHistory(history) : "История переводов не найдена.");
  });

  bot.command("purchase_history", async (ctx) => {
    const parsed = parseHistoryArgs(getCommandArgs(ctx), PURCHASE_HISTORY_USAGE);
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const userProfile = parsed.value.userRef
      ? resolveTelegramUserProfile(ctx, parsed.value.userRef)
      : getOwnProfile(ctx);

    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    if (!(await authorizationService.canReadAllianceUserData(
      getTelegramId(ctx),
      userProfile.value.telegramId,
      parsed.value.allianceId
    ))) {
      await ctx.reply("Недостаточно прав для просмотра истории этого участника.");
      return;
    }

    const history = await accountQueryService.getPurchaseHistory(
      parsed.value.allianceId,
      userProfile.value.telegramId,
      parsed.value.limit
    );
    await ctx.reply(history ? formatPurchaseHistory(history) : "История покупок не найдена.");
  });
}

export function parseBalanceArgs(args: readonly string[]): ParseResult<{
  allianceId: number;
  userRef?: TelegramUserRef;
}> {
  if (args.length < 1) {
    return { ok: false, message: BALANCE_USAGE };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  if (args[1] === undefined) {
    return {
      ok: true,
      value: {
        allianceId: allianceId.value
      }
    };
  }

  const userRef = parseTelegramUserRef(args[1]);
  if (!userRef.ok) {
    return userRef;
  }

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      userRef: userRef.value
    }
  };
}

export function parseHistoryArgs(args: readonly string[], usage = HISTORY_USAGE): ParseResult<{
  allianceId: number;
  userRef?: TelegramUserRef;
  limit: number;
}> {
  if (args.length < 1 || args.length > 3) {
    return { ok: false, message: usage };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  const secondArg = args[1];
  const thirdArg = args[2];
  let userRef: TelegramUserRef | undefined;
  let limit = DEFAULT_HISTORY_LIMIT;

  if (secondArg !== undefined) {
    const maybeLimit = parseHistoryLimit(secondArg);

    if (thirdArg === undefined) {
      if (!maybeLimit.ok) {
        return maybeLimit;
      }

      limit = maybeLimit.value;
    } else {
      const parsedUserRef = parseTelegramUserRef(secondArg);
      if (!parsedUserRef.ok) {
        return parsedUserRef;
      }

      userRef = parsedUserRef.value;
    }
  }

  if (thirdArg !== undefined) {
    const parsedLimit = parseHistoryLimit(thirdArg);
    if (!parsedLimit.ok) {
      return parsedLimit;
    }

    limit = parsedLimit.value;
  }

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      ...(userRef ? { userRef } : {}),
      limit
    }
  };
}

function parseOptionalUserRefArgs(
  args: readonly string[],
  usage: string
): ParseResult<TelegramUserRef | undefined> {
  if (args.length === 0) {
    return {
      ok: true,
      value: undefined
    };
  }

  if (args.length > 1) {
    return {
      ok: false,
      message: usage
    };
  }

  return parseTelegramUserRef(args[0]);
}

function parseSinglePositiveIntArgs(args: readonly string[], usage: string, name: string): ParseResult<number> {
  if (args.length !== 1) {
    return { ok: false, message: usage };
  }

  return parsePositiveInteger(args[0], `${name} должен быть положительным целым числом.`);
}

function parseHistoryLimit(token: string): ParseResult<number> {
  const parsed = parsePositiveInteger(token, `limit должен быть целым числом от 1 до ${MAX_HISTORY_LIMIT}.`);

  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.value > MAX_HISTORY_LIMIT) {
    return {
      ok: false,
      message: `limit должен быть целым числом от 1 до ${MAX_HISTORY_LIMIT}.`
    };
  }

  return parsed;
}

function getOwnProfile(ctx: BotContext): ParseResult<NonNullable<ReturnType<typeof getTelegramUserProfile>>> {
  const profile = getTelegramUserProfile(ctx.from);

  if (!profile) {
    return {
      ok: false,
      message: "Не удалось определить пользователя."
    };
  }

  return { ok: true, value: profile };
}

function getCommandArgs(ctx: BotContext): string[] {
  const text = ctx.message?.text ?? "";
  const [, ...args] = text.trim().split(/\s+/);

  return args;
}

function formatProfile(profile: Awaited<ReturnType<AccountQueryService["getProfile"]>> & {}): string {
  const alliances = profile.alliances.length > 0
    ? profile.alliances.map((alliance) => {
      const details = [
        alliance.role,
        alliance.faculty ? `факультет ${alliance.faculty.symbol} ${alliance.faculty.name}` : "",
        alliance.className ? `класс ${alliance.className}` : "",
        alliance.spec ? `спек ${alliance.spec}` : ""
      ].filter(Boolean).join(", ");

      return `#${alliance.allianceId} ${alliance.allianceName}: ${details}`;
    }).join("\n")
    : "нет";

  return [
    `Профиль #${profile.id}`,
    `Имя: ${profile.displayName}`,
    `Telegram: ${profile.telegramId.toString()}${profile.username ? ` (@${profile.username})` : ""}`,
    `Персонаж: ${profile.characterName ?? "не указан"}`,
    `Класс: ${profile.className ?? "не указан"}`,
    `Спек: ${profile.spec ?? "не указан"}`,
    `Активная ролевая: ${profile.activeAlliance ? `#${profile.activeAlliance.id} ${profile.activeAlliance.name}` : "не выбрана"}`,
    `Ролевые:\n${alliances}`
  ].join("\n");
}

function formatBalance(balance: Awaited<ReturnType<AccountQueryService["getBalances"]>> & {}): string {
  const rows = balance.balances.length > 0
    ? balance.balances.map((item) => `#${item.currencyId} ${item.currencyName}: ${item.amount} ${item.currencySymbol}`).join("\n")
    : "валют нет";

  return [
    `Баланс: ${balance.userDisplayName}`,
    `Ролевая: ${balance.allianceName}`,
    rows
  ].join("\n");
}

function formatAllianceInfo(alliance: Awaited<ReturnType<AccountQueryService["getAllianceInfo"]>> & {}): string {
  const currencies = alliance.currencies.length > 0
    ? alliance.currencies.map((currency) => `#${currency.id} ${currency.symbol} ${currency.name}`).join("\n")
    : "нет";
  const faculties = alliance.faculties.length > 0
    ? alliance.faculties.map((faculty) => `#${faculty.id} ${faculty.symbol} ${faculty.name}`).join("\n")
    : "нет";
  const shops = alliance.shops.length > 0
    ? alliance.shops.map((shop) => `#${shop.id} ${shop.name}`).join("\n")
    : "нет";

  return [
    `Ролевая #${alliance.id}: ${alliance.name} (${alliance.slug})`,
    `Участников: ${alliance.membersCount}`,
    `Валюты:\n${currencies}`,
    `Факультеты:\n${faculties}`,
    `Магазины:\n${shops}`
  ].join("\n");
}

function formatShop(shop: Awaited<ReturnType<AccountQueryService["getShopItems"]>> & {}): string {
  const items = shop.items.length > 0
    ? shop.items
      .map((item) => `#${item.id} ${item.name}: ${item.price} ${item.currencySymbol}, остаток ${item.stock ?? "без лимита"}`)
      .join("\n")
    : "товаров нет";

  return [`Магазин #${shop.shopId}: ${shop.shopName}`, items].join("\n");
}

function formatInventory(inventory: Awaited<ReturnType<AccountQueryService["getInventory"]>> & {}): string {
  const items = inventory.items.length > 0
    ? inventory.items.map((item) => `#${item.id} ${item.name}: ${item.quantity} шт.`).join("\n")
    : "пусто";

  return [`Инвентарь: ${inventory.userDisplayName}`, items].join("\n");
}

function formatTransferHistory(history: Awaited<ReturnType<AccountQueryService["getTransferHistory"]>> & {}): string {
  const transfers = history.transfers.length > 0
    ? history.transfers
      .map((transfer) => {
        const direction = transfer.direction === "outgoing" ? "->" : "<-";
        const comment = transfer.comment ? `, ${transfer.comment}` : "";

        return [
          `#${transfer.id} ${formatDate(transfer.createdAt)} ${direction} ${transfer.counterpartyDisplayName}`,
          `${transfer.amount} ${transfer.currencySymbol}, ${transfer.status}${comment}`
        ].join(" ");
      })
      .join("\n")
    : "операций нет";

  return [
    `История СБП: ${history.userDisplayName}`,
    `Ролевая: ${history.allianceName}`,
    transfers
  ].join("\n");
}

function formatPurchaseHistory(history: Awaited<ReturnType<AccountQueryService["getPurchaseHistory"]>> & {}): string {
  const purchases = history.purchases.length > 0
    ? history.purchases
      .map((purchase) => [
        `#${purchase.id} ${formatDate(purchase.createdAt)} ${purchase.itemName}`,
        `${purchase.quantity} шт., ${purchase.totalPrice} ${purchase.currencySymbol}, ${purchase.status}`
      ].join(" "))
      .join("\n")
    : "покупок нет";

  return [
    `История покупок: ${history.userDisplayName}`,
    `Ролевая: ${history.allianceName}`,
    purchases
  ].join("\n");
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
