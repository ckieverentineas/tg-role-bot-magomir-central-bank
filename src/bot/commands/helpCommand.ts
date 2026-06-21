import type { Bot } from "grammy";
import type { BotContext } from "../context.js";

const HELP_TEXT = [
  "Команды банка:",
  "/profile [telegramId|reply]",
  "/balance <allianceId> [telegramId|reply]",
  "/history <allianceId> [telegramId|reply] [limit]",
  "/purchase_history <allianceId> [telegramId|reply] [limit]",
  "/alliance_info <allianceId>",
  "/shop <shopId>",
  "/inventory [telegramId|reply]",
  "/sbp <allianceId> <currencyId> <receiverTelegramId|reply> <amount> [comment]",
  "/buy <itemId> <quantity>",
  "",
  "Админ-команды:",
  "/create_alliance <slug> <name>",
  "/create_currency <allianceId> <symbol> <name>",
  "/add_member <allianceId> <telegramId|reply> [member|bank_admin|super_admin]",
  "/set_balance <allianceId> <currencyId> <telegramId|reply> <amount>",
  "/adjust_balance <allianceId> <currencyId> <telegramId|reply> <+/-amount> [comment]",
  "/create_shop <allianceId> <name>",
  "/create_item <shopId> <currencyId> <price> <stock|none> <name>",
  "/set_sbp_limit <allianceId> <currencyId|all> <minAmount> <maxAmount> <periodAmountLimit|none> <period>",
  "/set_item_limit <itemId> <minQty> <maxQty> <periodQtyLimit|none> <period>",
  "/bind_log <allianceId> <type> <chatId> [topicId] [title]",
  "/bind_super_log <sourceTargetId> <superChatId> <topicId> [title]"
].join("\n");

export function registerHelpCommand(bot: Bot<BotContext>): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_TEXT);
  });
}
