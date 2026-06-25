import { InlineKeyboard, type Bot } from "grammy";
import type { AccountQueryService } from "../../application/read/accountQueryService.js";
import type {
  PlayerRegistrationService,
  RegisteredPlayerView,
  RegistrationAllianceView
} from "../../application/registration/playerRegistrationService.js";
import type { BotContext } from "../context.js";
import { getTelegramUserProfile } from "../telegramProfiles.js";

const REGISTRATION_DRAFT_TTL_MS = 10 * 60 * 1000;

type RegistrationDraft = {
  allianceId: number;
  facultyId?: number;
  expiresAt: number;
};

export function registerBankMenu(
  bot: Bot<BotContext>,
  playerRegistrationService: PlayerRegistrationService,
  accountQueryService: AccountQueryService
): void {
  const registrationDrafts = new Map<string, RegistrationDraft>();

  bot.command(["start", "bank"], async (ctx) => {
    await sendHome(ctx);
  });

  bot.callbackQuery("bank:home", async (ctx) => {
    await answerCallback(ctx);
    await sendHome(ctx);
  });

  bot.callbackQuery("bank:profile", async (ctx) => {
    await answerCallback(ctx);
    const profile = await getRegisteredPlayer(ctx, playerRegistrationService);

    if (!profile) {
      await respond(ctx, "Профиль игрока пока не заполнен.", registerKeyboard());
      return;
    }

    await respond(ctx, formatRegisteredPlayer(profile), mainKeyboard(true));
  });

  bot.callbackQuery("bank:register", async (ctx) => {
    await answerCallback(ctx);
    const alliances = await playerRegistrationService.listRegistrationAlliances();

    if (alliances.length === 0) {
      await respond(ctx, "Ролевые пока не настроены. Администратор может создать их через /create_alliance.", backKeyboard());
      return;
    }

    await respond(ctx, "Выберите ролевую для анкеты:", allianceKeyboard(alliances));
  });

  bot.callbackQuery(/^bank:reg:a:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    const allianceId = Number(ctx.match[1]);
    const alliances = await playerRegistrationService.listRegistrationAlliances();
    const alliance = alliances.find((item) => item.id === allianceId);

    if (!alliance) {
      await respond(ctx, "Ролевая не найдена.", backKeyboard());
      return;
    }

    if (alliance.faculties.length === 0) {
      setDraft(ctx, registrationDrafts, { allianceId, expiresAt: Date.now() + REGISTRATION_DRAFT_TTL_MS });
      await respond(ctx, registrationPrompt(alliance.name), cancelRegistrationKeyboard());
      return;
    }

    await respond(ctx, "Выберите факультет:", facultyKeyboard(alliance));
  });

  bot.callbackQuery(/^bank:reg:f:(\d+):(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    const allianceId = Number(ctx.match[1]);
    const facultyId = Number(ctx.match[2]);
    const alliances = await playerRegistrationService.listRegistrationAlliances();
    const alliance = alliances.find((item) => item.id === allianceId);

    if (!alliance) {
      await respond(ctx, "Ролевая не найдена.", backKeyboard());
      return;
    }

    setDraft(ctx, registrationDrafts, {
      allianceId,
      ...(facultyId > 0 ? { facultyId } : {}),
      expiresAt: Date.now() + REGISTRATION_DRAFT_TTL_MS
    });
    await respond(ctx, registrationPrompt(alliance.name), cancelRegistrationKeyboard());
  });

  bot.callbackQuery("bank:reg:cancel", async (ctx) => {
    await answerCallback(ctx);
    clearDraft(ctx, registrationDrafts);
    await respond(ctx, "Регистрация отменена.", mainKeyboard(false));
  });

  bot.callbackQuery("bank:balances", async (ctx) => {
    await answerCallback(ctx);
    const profile = await getRegisteredPlayer(ctx, playerRegistrationService);

    if (!profile?.activeAlliance) {
      await respond(ctx, "Сначала заполните профиль игрока.", registerKeyboard());
      return;
    }

    const balance = await accountQueryService.getBalances(profile.activeAlliance.id, profile.telegramId);
    await respond(ctx, balance ? formatBalance(balance) : "Баланс пока не найден.", mainKeyboard(true));
  });

  bot.callbackQuery("bank:shops", async (ctx) => {
    await answerCallback(ctx);
    const profile = await getRegisteredPlayer(ctx, playerRegistrationService);

    if (!profile?.activeAlliance) {
      await respond(ctx, "Сначала заполните профиль игрока.", registerKeyboard());
      return;
    }

    const alliance = await accountQueryService.getAllianceInfo(profile.activeAlliance.id);
    if (!alliance || alliance.shops.length === 0) {
      await respond(ctx, "В активной ролевой пока нет открытых магазинов.", mainKeyboard(true));
      return;
    }

    await respond(ctx, "Выберите магазин:", shopsKeyboard(alliance.shops));
  });

  bot.callbackQuery(/^bank:shop:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    const shopId = Number(ctx.match[1]);
    const shop = await accountQueryService.getShopItems(shopId);

    await respond(ctx, shop ? formatShop(shop) : "Магазин не найден.", mainKeyboard(true));
  });

  bot.callbackQuery("bank:inventory", async (ctx) => {
    await answerCallback(ctx);
    const profile = await getRegisteredPlayer(ctx, playerRegistrationService);

    if (!profile) {
      await respond(ctx, "Сначала заполните профиль игрока.", registerKeyboard());
      return;
    }

    const inventory = await accountQueryService.getInventory(profile.telegramId);
    await respond(ctx, inventory ? formatInventory(inventory) : "Инвентарь пока пуст.", mainKeyboard(true));
  });

  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) {
      await next();
      return;
    }

    const draft = getDraft(ctx, registrationDrafts);
    if (!draft) {
      await next();
      return;
    }

    const telegramProfile = getTelegramUserProfile(ctx.from);
    if (!telegramProfile) {
      await ctx.reply("Не удалось определить пользователя Telegram.");
      return;
    }

    const parsed = parseRegistrationDetails(text);
    if (!parsed) {
      await ctx.reply(registrationPrompt("выбранной ролевой"), { reply_markup: cancelRegistrationKeyboard() });
      return;
    }

    try {
      const profile = await playerRegistrationService.registerPlayer({
        telegramProfile,
        allianceId: draft.allianceId,
        characterName: parsed.characterName,
        ...(parsed.className ? { className: parsed.className } : {}),
        ...(parsed.spec ? { spec: parsed.spec } : {}),
        ...(draft.facultyId !== undefined ? { facultyId: draft.facultyId } : {})
      });

      clearDraft(ctx, registrationDrafts);
      await ctx.reply(["Профиль сохранён.", formatRegisteredPlayer(profile)].join("\n\n"), {
        reply_markup: mainKeyboard(true)
      });
    } catch (error) {
      await ctx.reply(formatError(error), { reply_markup: cancelRegistrationKeyboard() });
    }
  });
}

async function sendHome(ctx: BotContext): Promise<void> {
  await respond(ctx, "Магомирский Центральный Банк\nВыберите действие:", mainKeyboard(false));
}

function mainKeyboard(isRegistered: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("Профиль", "bank:profile")
    .text(isRegistered ? "Изменить анкету" : "Регистрация", "bank:register")
    .row()
    .text("Баланс", "bank:balances")
    .text("Магазины", "bank:shops")
    .row()
    .text("Инвентарь", "bank:inventory");

  return keyboard;
}

function registerKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Регистрация", "bank:register")
    .row()
    .text("Назад", "bank:home");
}

function backKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Назад", "bank:home");
}

function cancelRegistrationKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Отменить", "bank:reg:cancel")
    .row()
    .text("Назад", "bank:home");
}

function allianceKeyboard(alliances: readonly RegistrationAllianceView[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  alliances.forEach((alliance) => {
    keyboard.text(alliance.name, `bank:reg:a:${alliance.id}`).row();
  });
  keyboard.text("Назад", "bank:home");

  return keyboard;
}

function facultyKeyboard(alliance: RegistrationAllianceView): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  alliance.faculties.forEach((faculty) => {
    keyboard.text(`${faculty.symbol} ${faculty.name}`, `bank:reg:f:${alliance.id}:${faculty.id}`).row();
  });
  keyboard.text("Без факультета", `bank:reg:f:${alliance.id}:0`).row();
  keyboard.text("Назад", "bank:register");

  return keyboard;
}

function shopsKeyboard(shops: readonly { id: number; name: string }[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  shops.forEach((shop) => {
    keyboard.text(shop.name, `bank:shop:${shop.id}`).row();
  });
  keyboard.text("Назад", "bank:home");

  return keyboard;
}

async function respond(ctx: BotContext, text: string, replyMarkup: InlineKeyboard): Promise<void> {
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, { reply_markup: replyMarkup });
      return;
    } catch {
      // Reply below when Telegram cannot edit the original message.
    }
  }

  await ctx.reply(text, { reply_markup: replyMarkup });
}

async function answerCallback(ctx: BotContext): Promise<void> {
  try {
    await ctx.answerCallbackQuery();
  } catch {
    // Callback may already be answered by Telegram clients after a retry.
  }
}

async function getRegisteredPlayer(
  ctx: BotContext,
  playerRegistrationService: PlayerRegistrationService
): Promise<RegisteredPlayerView | null> {
  const telegramProfile = getTelegramUserProfile(ctx.from);

  return telegramProfile ? playerRegistrationService.getPlayer(telegramProfile.telegramId) : null;
}

function setDraft(
  ctx: BotContext,
  drafts: Map<string, RegistrationDraft>,
  draft: RegistrationDraft
): void {
  const key = draftKey(ctx);
  if (key) {
    drafts.set(key, draft);
  }
}

function getDraft(ctx: BotContext, drafts: Map<string, RegistrationDraft>): RegistrationDraft | null {
  const key = draftKey(ctx);
  if (!key) {
    return null;
  }

  const draft = drafts.get(key);
  if (!draft) {
    return null;
  }

  if (draft.expiresAt < Date.now()) {
    drafts.delete(key);
    return null;
  }

  return draft;
}

function clearDraft(ctx: BotContext, drafts: Map<string, RegistrationDraft>): void {
  const key = draftKey(ctx);
  if (key) {
    drafts.delete(key);
  }
}

function draftKey(ctx: BotContext): string | null {
  return ctx.from ? ctx.from.id.toString() : null;
}

function registrationPrompt(allianceName: string): string {
  return [
    `Отправьте анкету для ${allianceName}.`,
    "Первая строка: имя персонажа.",
    "Вторая строка: класс.",
    "Третья строка: специализация.",
    "Можно одной строкой через ;"
  ].join("\n");
}

function parseRegistrationDetails(text: string): { characterName: string; className?: string; spec?: string } | null {
  const parts = text
    .split(/\n|;/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const characterName = parts[0];
  if (!characterName) {
    return null;
  }

  const className = parts[1];
  const spec = parts.slice(2).join(" ").trim();

  return {
    characterName,
    ...(className ? { className } : {}),
    ...(spec ? { spec } : {})
  };
}

function formatRegisteredPlayer(profile: RegisteredPlayerView): string {
  return [
    `Профиль #${profile.id}`,
    `Игрок: ${profile.characterName}`,
    `Telegram: ${profile.displayName} (${profile.telegramId.toString()})`,
    `Ролевая: ${profile.activeAlliance?.name ?? "не выбрана"}`,
    `Факультет: ${profile.faculty ? `${profile.faculty.symbol} ${profile.faculty.name}` : "не выбран"}`,
    `Класс: ${profile.className ?? "не указан"}`,
    `Специализация: ${profile.spec ?? "не указана"}`
  ].join("\n");
}

function formatBalance(balance: Awaited<ReturnType<AccountQueryService["getBalances"]>> & {}): string {
  const rows = balance.balances.length > 0
    ? balance.balances.map((item) => `${item.currencyName}: ${item.amount} ${item.currencySymbol}`).join("\n")
    : "валют нет";

  return [
    `Баланс: ${balance.userDisplayName}`,
    `Ролевая: ${balance.allianceName}`,
    rows
  ].join("\n");
}

function formatShop(shop: Awaited<ReturnType<AccountQueryService["getShopItems"]>> & {}): string {
  const items = shop.items.length > 0
    ? shop.items
      .map((item) => `#${item.id} ${item.name}: ${item.price} ${item.currencySymbol}, остаток ${item.stock ?? "без лимита"}`)
      .join("\n")
    : "товаров нет";

  return [
    `Магазин #${shop.shopId}: ${shop.shopName}`,
    items,
    "Покупка: /buy <itemId> <quantity>"
  ].join("\n");
}

function formatInventory(inventory: Awaited<ReturnType<AccountQueryService["getInventory"]>> & {}): string {
  const items = inventory.items.length > 0
    ? inventory.items.map((item) => `#${item.id} ${item.name}: ${item.quantity} шт.`).join("\n")
    : "пусто";

  return [`Инвентарь: ${inventory.userDisplayName}`, items].join("\n");
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Ошибка: ${error.message}`;
  }

  return "Ошибка: не удалось выполнить действие.";
}
