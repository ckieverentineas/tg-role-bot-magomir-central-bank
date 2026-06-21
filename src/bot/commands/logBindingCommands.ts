import type { Bot } from "grammy";
import type { LogRoutingService } from "../../application/logs/logRoutingService.js";
import type { AuthorizationService } from "../../application/auth/authorizationService.js";
import type { AppConfig } from "../../config/env.js";
import { LOG_EVENT_TYPE, type LogEventType } from "../../domain/logs/logEventType.js";
import type { TelegramLogSink } from "../../infrastructure/telegram/telegramLogSink.js";
import { sendAdminAuditLog } from "../adminAuditLog.js";
import { requireAdmin, requireAllianceAdmin } from "../middleware/adminOnly.js";
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

export function registerLogBindingCommands(
  bot: Bot<BotContext>,
  logRoutingService: LogRoutingService,
  telegramLogSink: TelegramLogSink,
  authorizationService: AuthorizationService,
  config: AppConfig
): void {
  bot.command("bind_log", async (ctx) => {
    const parsed = parseBindLogArgs(getCommandArgs(ctx));

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

    const parsed = parseBindSuperLogArgs(getCommandArgs(ctx));

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
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

function parseBindLogArgs(args: readonly string[]): ParseResult<{
  allianceId: number;
  eventType: LogEventType;
  chatId: bigint;
  topicId?: number;
  title?: string;
}> {
  if (args.length < 3) {
    return {
      ok: false,
      message: "Формат: /bind_log <allianceId> <type> <chatId> [topicId] [title]"
    };
  }

  const allianceId = parsePositiveInt(args[0]);
  const eventType = parseLogEventType(args[1]);
  const chatId = parseTelegramChatId(args[2]);

  if (allianceId === null || eventType === null || chatId === null) {
    return {
      ok: false,
      message: "Проверьте allianceId, type и chatId. Типы: finance, progression, purchase, admin, security, system."
    };
  }

  const { topicId, title } = parseOptionalTopicAndTitle(args, 3);

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

function parseBindSuperLogArgs(args: readonly string[]): ParseResult<{
  sourceTargetId: number;
  chatId: bigint;
  topicId: number;
  title?: string;
}> {
  if (args.length < 3) {
    return {
      ok: false,
      message: "Формат: /bind_super_log <sourceTargetId> <superChatId> <topicId> [title]"
    };
  }

  const sourceTargetId = parsePositiveInt(args[0]);
  const chatId = parseTelegramChatId(args[1]);
  const topicId = parsePositiveInt(args[2]);

  if (sourceTargetId === null || chatId === null || topicId === null) {
    return {
      ok: false,
      message: "Проверьте sourceTargetId, superChatId и topicId."
    };
  }

  const title = args.slice(3).join(" ").trim();

  return {
    ok: true,
    value: {
      sourceTargetId,
      chatId,
      topicId,
      ...(title ? { title } : {})
    }
  };
}

function getCommandArgs(ctx: BotContext): string[] {
  const text = ctx.message?.text ?? "";
  const [, ...args] = text.trim().split(/\s+/);

  return args;
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

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Ошибка: ${error.message}`;
  }

  return "Ошибка: не удалось выполнить команду.";
}
