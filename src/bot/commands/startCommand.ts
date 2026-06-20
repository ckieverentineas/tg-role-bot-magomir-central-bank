import type { Bot } from "grammy";
import type { BotContext } from "../context.js";

export function registerStartCommand(bot: Bot<BotContext>): void {
  bot.command("start", async (ctx) => {
    await ctx.reply("Магомирский Центральный Банк подключён. Используйте /health для проверки состояния.");
  });
}
