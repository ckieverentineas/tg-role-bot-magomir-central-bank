import type { Prisma, PrismaClient } from "@prisma/client";
import { parseLogEventType, type LogEventType } from "../../domain/logs/logEventType.js";
import { LOG_TARGET_SCOPE, type LogTargetScope } from "../../domain/logs/logTargetScope.js";

const logTargetSelect = {
  id: true,
  allianceId: true,
  scope: true,
  eventType: true,
  chatId: true,
  topicId: true,
  title: true,
  sourceTargetId: true
} satisfies Prisma.LogTargetSelect;

export type LogDeliveryTarget = Prisma.LogTargetGetPayload<{
  select: typeof logTargetSelect;
}>;

export type BindLocalLogTargetInput = {
  allianceId: number;
  eventType: LogEventType;
  chatId: bigint;
  topicId?: number;
  title?: string;
  createdByUserId?: number;
};

export type BindSuperadminMirrorInput = {
  sourceTargetId: number;
  chatId: bigint;
  topicId: number;
  title?: string;
  createdByUserId?: number;
};

export class LogRoutingService {
  public constructor(private readonly db: PrismaClient) {}

  public async bindLocalTarget(input: BindLocalLogTargetInput): Promise<LogDeliveryTarget> {
    return this.upsertTarget({
      allianceId: input.allianceId,
      scope: LOG_TARGET_SCOPE.LOCAL,
      eventType: input.eventType,
      chatId: input.chatId,
      ...optional("topicId", input.topicId),
      ...optional("title", input.title),
      ...optional("createdByUserId", input.createdByUserId)
    });
  }

  public async bindSuperadminMirror(input: BindSuperadminMirrorInput): Promise<LogDeliveryTarget> {
    const sourceTarget = await this.db.logTarget.findUnique({
      where: {
        id: input.sourceTargetId
      },
      select: logTargetSelect
    });

    if (!sourceTarget || sourceTarget.scope !== LOG_TARGET_SCOPE.LOCAL) {
      throw new Error("Source log target must be an existing local log target.");
    }

    return this.upsertTarget({
      scope: LOG_TARGET_SCOPE.SUPERADMIN_MIRROR,
      eventType: parseLogEventType(sourceTarget.eventType),
      chatId: input.chatId,
      topicId: input.topicId,
      sourceTargetId: sourceTarget.id,
      ...optional("allianceId", sourceTarget.allianceId ?? undefined),
      ...optional("title", input.title),
      ...optional("createdByUserId", input.createdByUserId)
    });
  }

  public async resolveDeliveryTargets(allianceId: number, eventType: LogEventType): Promise<LogDeliveryTarget[]> {
    const localTargets = await this.db.logTarget.findMany({
      where: {
        allianceId,
        eventType,
        scope: LOG_TARGET_SCOPE.LOCAL,
        isActive: true
      },
      select: logTargetSelect
    });

    if (localTargets.length === 0) {
      return [];
    }

    const mirrorTargets = await this.db.logTarget.findMany({
      where: {
        scope: LOG_TARGET_SCOPE.SUPERADMIN_MIRROR,
        isActive: true,
        sourceTargetId: {
          in: localTargets.map((target) => target.id)
        }
      },
      select: logTargetSelect
    });

    return [...localTargets, ...mirrorTargets];
  }

  private async upsertTarget(input: {
    allianceId?: number;
    scope: LogTargetScope;
    eventType: LogEventType;
    chatId: bigint;
    topicId?: number;
    title?: string;
    sourceTargetId?: number;
    createdByUserId?: number;
  }): Promise<LogDeliveryTarget> {
    const topicId = input.topicId ?? null;
    const title = normalizeOptionalText(input.title);

    const existingTarget = await this.db.logTarget.findFirst({
      where: {
        allianceId: input.allianceId ?? null,
        scope: input.scope,
        eventType: input.eventType,
        chatId: input.chatId,
        topicId,
        sourceTargetId: input.sourceTargetId ?? null
      },
      select: {
        id: true
      }
    });

    if (existingTarget) {
      return this.db.logTarget.update({
        where: {
          id: existingTarget.id
        },
        data: {
          isActive: true,
          title,
          createdByUserId: input.createdByUserId ?? null
        },
        select: logTargetSelect
      });
    }

    return this.db.logTarget.create({
      data: {
        allianceId: input.allianceId ?? null,
        scope: input.scope,
        eventType: input.eventType,
        chatId: input.chatId,
        topicId,
        title,
        sourceTargetId: input.sourceTargetId ?? null,
        createdByUserId: input.createdByUserId ?? null
      },
      select: logTargetSelect
    });
  }
}

function normalizeOptionalText(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function optional<TKey extends string, TValue>(
  key: TKey,
  value: TValue | undefined
): Record<TKey, TValue> | Record<string, never> {
  return value === undefined ? {} : { [key]: value } as Record<TKey, TValue>;
}
