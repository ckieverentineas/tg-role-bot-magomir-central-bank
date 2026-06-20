import type { LogRoutingService } from "../application/logs/logRoutingService.js";
import type { LogEventType } from "../domain/logs/logEventType.js";
import type { TelegramLogSink } from "../infrastructure/telegram/telegramLogSink.js";

export type OperationLogPayload = {
  allianceId: number;
  logEventType: LogEventType;
  logText: string;
};

export async function sendOperationLog(
  logRoutingService: LogRoutingService,
  telegramLogSink: TelegramLogSink,
  operation: OperationLogPayload
): Promise<void> {
  const targets = await logRoutingService.resolveDeliveryTargets(operation.allianceId, operation.logEventType);
  const results = await Promise.allSettled(targets.map((target) => telegramLogSink.send(target, operation.logText)));

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to send operation log", result.reason);
    }
  }
}
