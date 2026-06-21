import { Bot } from "grammy";
import type { PrismaClient } from "@prisma/client";
import { AuthorizationService } from "../application/auth/authorizationService.js";
import { BalanceAdjustmentService } from "../application/banking/balanceAdjustmentService.js";
import { LogRoutingService } from "../application/logs/logRoutingService.js";
import { AccountQueryService } from "../application/read/accountQueryService.js";
import { SbpTransferRuleAdminService } from "../application/sbp/sbpTransferRuleAdminService.js";
import { SbpTransferExecutionService } from "../application/sbp/sbpTransferExecutionService.js";
import { AdminSetupService } from "../application/setup/adminSetupService.js";
import { ShopItemLimitAdminService } from "../application/shop/shopItemLimitAdminService.js";
import { ShopPurchaseExecutionService } from "../application/shop/shopPurchaseExecutionService.js";
import { TelegramUserService } from "../application/users/telegramUserService.js";
import type { AppConfig } from "../config/env.js";
import { TelegramLogSink } from "../infrastructure/telegram/telegramLogSink.js";
import { registerHealthCommand } from "./commands/healthCommand.js";
import { registerHelpCommand } from "./commands/helpCommand.js";
import { registerBalanceAdminCommands } from "./commands/balanceAdminCommands.js";
import { registerLimitCommands } from "./commands/limitCommands.js";
import { registerLogBindingCommands } from "./commands/logBindingCommands.js";
import { registerOperationCommands } from "./commands/operationCommands.js";
import { registerQueryCommands } from "./commands/queryCommands.js";
import { registerSetupCommands } from "./commands/setupCommands.js";
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
  const adminSetupService = new AdminSetupService(db);
  const accountQueryService = new AccountQueryService(db);
  const balanceAdjustmentService = new BalanceAdjustmentService(db);
  const authorizationService = new AuthorizationService(db, config);

  registerStartCommand(bot);
  registerHelpCommand(bot);
  registerHealthCommand(bot);
  registerQueryCommands(bot, accountQueryService);
  registerLogBindingCommands(bot, logRoutingService, authorizationService, config);
  registerSetupCommands(bot, adminSetupService, authorizationService, config);
  registerBalanceAdminCommands(bot, balanceAdjustmentService, logRoutingService, telegramLogSink, authorizationService);
  registerLimitCommands(bot, sbpRuleAdminService, shopItemLimitAdminService, authorizationService);
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
