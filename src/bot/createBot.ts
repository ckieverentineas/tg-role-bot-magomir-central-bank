import { Bot } from "grammy";
import type { PrismaClient } from "@prisma/client";
import { LogRoutingService } from "../application/logs/logRoutingService.js";
import { SbpTransferRuleAdminService } from "../application/sbp/sbpTransferRuleAdminService.js";
import { SbpTransferExecutionService } from "../application/sbp/sbpTransferExecutionService.js";
import { ShopItemLimitAdminService } from "../application/shop/shopItemLimitAdminService.js";
import { ShopPurchaseExecutionService } from "../application/shop/shopPurchaseExecutionService.js";
import { TelegramUserService } from "../application/users/telegramUserService.js";
import type { AppConfig } from "../config/env.js";
import { TelegramLogSink } from "../infrastructure/telegram/telegramLogSink.js";
import { registerHealthCommand } from "./commands/healthCommand.js";
import { registerLimitCommands } from "./commands/limitCommands.js";
import { registerLogBindingCommands } from "./commands/logBindingCommands.js";
import { registerOperationCommands } from "./commands/operationCommands.js";
import { registerStartCommand } from "./commands/startCommand.js";
import type { BotContext } from "./context.js";

export function createBot(config: AppConfig, db: PrismaClient): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.botToken);
  const logRoutingService = new LogRoutingService(db);
  const sbpRuleAdminService = new SbpTransferRuleAdminService(db);
  const sbpTransferExecutionService = new SbpTransferExecutionService(db);
  const shopItemLimitAdminService = new ShopItemLimitAdminService(db);
  const shopPurchaseExecutionService = new ShopPurchaseExecutionService(db);
  const telegramUserService = new TelegramUserService(db);
  const telegramLogSink = new TelegramLogSink(bot);

  registerStartCommand(bot);
  registerHealthCommand(bot);
  registerLogBindingCommands(bot, logRoutingService, config);
  registerLimitCommands(bot, sbpRuleAdminService, shopItemLimitAdminService, config);
  registerOperationCommands(
    bot,
    telegramUserService,
    sbpTransferExecutionService,
    shopPurchaseExecutionService,
    logRoutingService,
    telegramLogSink
  );

  bot.catch((error) => {
    console.error("Telegram bot error", error);
  });

  return bot;
}
