import type { LogRoutingService } from "../application/logs/logRoutingService.js";
import { LOG_EVENT_TYPE } from "../domain/logs/logEventType.js";
import type { TelegramLogSink } from "../infrastructure/telegram/telegramLogSink.js";
import type { BotContext } from "./context.js";
import { sendOperationLog } from "./logDelivery.js";

export type AdminAuditLogInput = {
  ctx: BotContext;
  logRoutingService: LogRoutingService;
  telegramLogSink: TelegramLogSink;
  allianceId: number;
  action: string;
  details?: readonly string[];
};

export async function sendAdminAuditLog(input: AdminAuditLogInput): Promise<void> {
  try {
    const logText = [
      "Админ-действие",
      `Действие: ${input.action}`,
      `Админ: ${formatActor(input.ctx)}`,
      ...(input.details ?? [])
    ].join("\n");

    await sendOperationLog(input.logRoutingService, input.telegramLogSink, {
      allianceId: input.allianceId,
      logEventType: LOG_EVENT_TYPE.ADMIN,
      logText
    });
  } catch (error) {
    console.error("Failed to send admin audit log", error);
  }
}

function formatActor(ctx: BotContext): string {
  const user = ctx.from;

  if (!user) {
    return "неизвестно";
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  const label = user.username ? `@${user.username}` : displayName || "без имени";

  return `${label} (${user.id})`;
}
