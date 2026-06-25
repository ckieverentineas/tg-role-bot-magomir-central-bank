import type { Bot } from "grammy";
import type { LogDeliveryTarget, LogRoutingService } from "../../application/logs/logRoutingService.js";
import type { AuthorizationService } from "../../application/auth/authorizationService.js";
import type { AppConfig } from "../../config/env.js";
import { LOG_EVENT_TYPE, type LogEventType } from "../../domain/logs/logEventType.js";
import { LOG_TARGET_SCOPE } from "../../domain/logs/logTargetScope.js";
import type { TelegramLogSink } from "../../infrastructure/telegram/telegramLogSink.js";
import { sendAdminAuditLog } from "../adminAuditLog.js";
import { requireAdmin, requireAllianceAdmin } from "../middleware/adminOnly.js";
import { getCommandArgs } from "../telegramText.js";
import type { BotContext } from "../context.js";

const LOG_EVENT_TYPE_BY_ALIAS: Readonly<Record<string, LogEventType>> = {
  finance: LOG_EVENT_TYPE.FINANCE,
  finances: LOG_EVENT_TYPE.FINANCE,
  "финансы": LOG_EVENT_TYPE.FINANCE,
  "финансовый": LOG_EVENT_TYPE.FINANCE,
  progression: LOG_EVENT_TYPE.PROGRESSION,
  progress: LOG_EVENT_TYPE.PROGRESSION,
  "прокачка": LOG_EVENT_TYPE.PROGRESSION,
  "прокачки": LOG_EVENT_TYPE.PROGRESSION,
  purchase: LOG_EVENT_TYPE.PURCHASE,
  purchases: LOG_EVENT_TYPE.PURCHASE,
  shop: LOG_EVENT_TYPE.PURCHASE,
  "покупки": LOG_EVENT_TYPE.PURCHASE,
  admin: LOG_EVENT_TYPE.ADMIN,
  "админ": LOG_EVENT_TYPE.ADMIN,
  security: LOG_EVENT_TYPE.SECURITY,
  "безопасность": LOG_EVENT_TYPE.SECURITY,
  system: LOG_EVENT_TYPE.SYSTEM,
  "система": LOG_EVENT_TYPE.SYSTEM
};

const LOG_TARGET_ACTIVE_USAGE = "Формат: /disable_log <targetId> или /enable_log <targetId>";

export function registerLogBindingCommands(
  bot: Bot<BotContext>,
  logRoutingService: LogRoutingService,
  telegramLogSink: TelegramLogSink,
  authorizationService: AuthorizationService,
  config: AppConfig
): void {
  bot.command("bind_log", async (ctx) => {
    const parsed = parseBindLogArgs(getCommandArgs(ctx), getCurrentLogLocation(ctx));

    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    if (!(await requireAllianceAdmin(ctx, authorizationService, parsed.value.allianceId))) {
      return;
    }

    try {
      const target = await logRoutingService.bindLocalTarget(parsed.value);
      await sendAdminAuditLog({
        ctx,
        logRoutingService,
        telegramLogSink,
        allianceId: parsed.value.allianceId,
        action: "Привязка локального лог-чата",
        details: [
          `Target: #${target.id}`,
          `Тип: ${target.eventType}`,
          `Чат: ${target.chatId.toString()}`,
          `Тема: ${target.topicId ?? "без темы"}`,
          `Название: ${target.title ?? "не задано"}`
        ]
      });
      await ctx.reply(`Лог-чат привязан: target #${target.id}, ${formatTopic(target.topicId)}.`);
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("bind_super_log", async (ctx) => {
    if (!(await requireAdmin(ctx, config))) {
      return;
    }

    const parsed = parseBindSuperLogArgs(getCommandArgs(ctx), getCurrentLogLocation(ctx));

    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    try {
      const target = await logRoutingService.bindSuperadminMirror(parsed.value);
      if (target.allianceId !== null) {
        await sendAdminAuditLog({
          ctx,
          logRoutingService,
          telegramLogSink,
          allianceId: target.allianceId,
          action: "Привязка суперадминского зеркала логов",
          details: [
            `Mirror target: #${target.id}`,
            `Source target: #${parsed.value.sourceTargetId}`,
            `Тип: ${target.eventType}`,
            `Чат: ${target.chatId.toString()}`,
            `Тема: ${target.topicId ?? "без темы"}`,
            `Название: ${target.title ?? "не задано"}`
          ]
        });
      }
      await ctx.reply(`Суперадминское зеркало привязано: target #${target.id}, ${formatTopic(target.topicId)}.`);
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("disable_log", async (ctx) => {
    await handleLogTargetActiveCommand(ctx, logRoutingService, telegramLogSink, authorizationService, config, false);
  });

  bot.command("enable_log", async (ctx) => {
    await handleLogTargetActiveCommand(ctx, logRoutingService, telegramLogSink, authorizationService, config, true);
  });
}

async function handleLogTargetActiveCommand(
  ctx: BotContext,
  logRoutingService: LogRoutingService,
  telegramLogSink: TelegramLogSink,
  authorizationService: AuthorizationService,
  config: AppConfig,
  isActive: boolean
): Promise<void> {
  const parsed = parseLogTargetActiveArgs(getCommandArgs(ctx));
  if (!parsed.ok) {
    await ctx.reply(parsed.message);
    return;
  }

  const existingTarget = await logRoutingService.getTarget(parsed.value.targetId);
  if (!existingTarget) {
    await ctx.reply("Лог-таргет не найден.");
    return;
  }

  if (!(await canManageLogTarget(ctx, existingTarget, authorizationService, config))) {
    return;
  }

  try {
    const target = await logRoutingService.setTargetActive({
      targetId: parsed.value.targetId,
      isActive
    });
    await ctx.reply(formatLogTargetActive(target, isActive));

    if (target.allianceId !== null) {
      await sendAdminAuditLog({
        ctx,
        logRoutingService,
        telegramLogSink,
        allianceId: target.allianceId,
        action: isActive ? "Включение лог-таргета" : "Отключение лог-таргета",
        details: [
          `Target: #${target.id}`,
          `Scope: ${target.scope}`,
          `Тип: ${target.eventType}`,
          `Чат: ${target.chatId.toString()}`,
          `Тема: ${target.topicId ?? "без темы"}`
        ]
      });
    }
  } catch (error) {
    await ctx.reply(formatError(error));
  }
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

type CurrentLogLocation = {
  chatId?: bigint;
  topicId?: number;
};

async function canManageLogTarget(
  ctx: BotContext,
  target: LogDeliveryTarget,
  authorizationService: AuthorizationService,
  config: AppConfig
): Promise<boolean> {
  if (target.scope === LOG_TARGET_SCOPE.SUPERADMIN_MIRROR || target.allianceId === null) {
    return requireAdmin(ctx, config);
  }

  return requireAllianceAdmin(ctx, authorizationService, target.allianceId);
}

export function parseBindLogArgs(args: readonly string[], currentLocation: CurrentLogLocation = {}): ParseResult<{
  allianceId: number;
  eventType: LogEventType;
  chatId: bigint;
  topicId?: number;
  title?: string;
}> {
  if (args.length < 2) {
    return {
      ok: false,
      message: "Формат: /bind_log <allianceId> <type> [title] или старый формат: /bind_log <allianceId> <type> <chatId> [topicId] [title]"
    };
  }

  const allianceId = parsePositiveInt(args[0]);
  const eventType = parseLogEventType(args[1]);

  if (allianceId === null || eventType === null) {
    return {
      ok: false,
      message: "Проверьте allianceId и type. Типы: finance, progression, purchase, admin, security, system."
    };
  }

  const explicitChatId = parseTelegramChatId(args[2]);
  const chatId = explicitChatId ?? currentLocation.chatId;

  if (chatId === undefined) {
    return {
      ok: false,
      message: "Напишите команду в нужном лог-чате/теме или укажите chatId явно."
    };
  }

  const { topicId, title } = explicitChatId === null
    ? {
        ...optionalCurrentTopic(currentLocation.topicId),
        ...optionalTitle(args.slice(2).join(" "))
      }
    : parseOptionalTopicAndTitle(args, 3);

  return {
    ok: true,
    value: {
      allianceId,
      eventType,
      chatId,
      ...(topicId !== undefined ? { topicId } : {}),
      ...(title ? { title } : {})
    }
  };
}

export function parseBindSuperLogArgs(args: readonly string[], currentLocation: CurrentLogLocation = {}): ParseResult<{
  sourceTargetId: number;
  chatId: bigint;
  topicId?: number;
  title?: string;
}> {
  if (args.length < 1) {
    return {
      ok: false,
      message: "Формат: /bind_super_log <sourceTargetId> [title] или старый формат: /bind_super_log <sourceTargetId> <superChatId> <topicId> [title]"
    };
  }

  const sourceTargetId = parsePositiveInt(args[0]);

  if (sourceTargetId === null) {
    return {
      ok: false,
      message: "sourceTargetId должен быть положительным целым числом."
    };
  }

  const explicitChatId = parseTelegramChatId(args[1]);
  const chatId = explicitChatId ?? currentLocation.chatId;

  if (chatId === undefined) {
    return {
      ok: false,
      message: "Напишите команду в нужном суперлог-чате/теме или укажите superChatId явно."
    };
  }

  const explicitTopicId = explicitChatId === null ? undefined : parsePositiveInt(args[2]);
  if (explicitChatId !== null && explicitTopicId === null) {
    return {
      ok: false,
      message: "Проверьте superChatId и topicId."
    };
  }

  const title = explicitChatId === null ? args.slice(1).join(" ").trim() : args.slice(3).join(" ").trim();
  const topicId = explicitTopicId ?? currentLocation.topicId;

  return {
    ok: true,
    value: {
      sourceTargetId,
      chatId,
      ...(topicId !== undefined ? { topicId } : {}),
      ...(title ? { title } : {})
    }
  };
}

export function parseLogTargetActiveArgs(args: readonly string[]): ParseResult<{ targetId: number }> {
  if (args.length < 1) {
    return {
      ok: false,
      message: LOG_TARGET_ACTIVE_USAGE
    };
  }

  const targetId = parsePositiveInt(args[0]);
  if (targetId === null) {
    return {
      ok: false,
      message: "targetId должен быть положительным целым числом."
    };
  }

  return {
    ok: true,
    value: {
      targetId
    }
  };
}

function parseOptionalTopicAndTitle(
  args: readonly string[],
  topicIndex: number
): { topicId?: number; title?: string } {
  const topicToken = args[topicIndex];

  if (topicToken === undefined) {
    return {};
  }

  if (topicToken === "-") {
    const title = args.slice(topicIndex + 1).join(" ").trim();
    return title ? { title } : {};
  }

  const topicId = parsePositiveInt(topicToken);

  if (topicId === null) {
    const title = args.slice(topicIndex).join(" ").trim();
    return title ? { title } : {};
  }

  const title = args.slice(topicIndex + 1).join(" ").trim();

  return {
    topicId,
    ...(title ? { title } : {})
  };
}

function optionalCurrentTopic(topicId: number | undefined): { topicId?: number } {
  return topicId === undefined ? {} : { topicId };
}

function optionalTitle(value: string): { title?: string } {
  const title = value.trim();

  return title ? { title } : {};
}

function getCurrentLogLocation(ctx: BotContext): CurrentLogLocation {
  const chatId = typeof ctx.chat?.id === "number" ? BigInt(ctx.chat.id) : undefined;
  const topicId = ctx.message && "message_thread_id" in ctx.message ? ctx.message.message_thread_id : undefined;

  return {
    ...(chatId !== undefined ? { chatId } : {}),
    ...(typeof topicId === "number" ? { topicId } : {})
  };
}

function parsePositiveInt(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseTelegramChatId(value: string | undefined): bigint | null {
  if (value === undefined || !/^-?\d+$/.test(value)) {
    return null;
  }

  return BigInt(value);
}

function parseLogEventType(value: string | undefined): LogEventType | null {
  if (!value) {
    return null;
  }

  return LOG_EVENT_TYPE_BY_ALIAS[value.toLowerCase()] ?? null;
}

function formatTopic(topicId: number | null): string {
  return topicId === null ? "без темы" : `тема ${topicId}`;
}

function formatLogTargetActive(target: LogDeliveryTarget, isActive: boolean): string {
  return `Лог-таргет ${isActive ? "включён" : "отключён"}: target #${target.id}, ${formatTopic(target.topicId)}.`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Ошибка: ${error.message}`;
  }

  return "Ошибка: не удалось выполнить команду.";
}
