import type { Bot } from "grammy";
import type {
  PlayerRegistrationService,
  RegisterPlayerInput,
  RegisteredPlayerView,
  RegistrationAllianceView
} from "../../application/registration/playerRegistrationService.js";
import { parsePositiveInteger, type ParseResult } from "../../application/limits/limitPeriodInput.js";
import type { BotContext } from "../context.js";
import { getTelegramUserProfile } from "../telegramProfiles.js";
import { getCommandArgs } from "../telegramText.js";

const REGISTER_USAGE = "Формат: /register <allianceId> <facultyId|none> <characterName> [| class] [| spec]";

export type ParsedRegisterPlayerCommand = Omit<RegisterPlayerInput, "telegramProfile">;

export function registerRegistrationCommands(
  bot: Bot<BotContext>,
  playerRegistrationService: PlayerRegistrationService
): void {
  bot.command("registration_options", async (ctx) => {
    const alliances = await playerRegistrationService.listRegistrationAlliances();
    await ctx.reply(formatRegistrationOptions(alliances));
  });

  bot.command("register", async (ctx) => {
    const telegramProfile = getTelegramUserProfile(ctx.from);
    if (!telegramProfile) {
      await ctx.reply("Не удалось определить игрока.");
      return;
    }

    const parsed = parseRegisterPlayerArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    try {
      const player = await playerRegistrationService.registerPlayer({
        telegramProfile,
        ...parsed.value
      });

      await ctx.reply(formatRegisteredPlayer(player));
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("my_registration", async (ctx) => {
    const telegramProfile = getTelegramUserProfile(ctx.from);
    if (!telegramProfile) {
      await ctx.reply("Не удалось определить игрока.");
      return;
    }

    const player = await playerRegistrationService.getPlayer(telegramProfile.telegramId);
    await ctx.reply(player ? formatRegisteredPlayer(player) : "Регистрация игрока пока не найдена.");
  });
}

export function parseRegisterPlayerArgs(args: readonly string[]): ParseResult<ParsedRegisterPlayerCommand> {
  if (args.length < 3) {
    return { ok: false, message: REGISTER_USAGE };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  const facultyId = parseOptionalFacultyId(args[1]);
  if (!facultyId.ok) {
    return facultyId;
  }

  const segments = splitSegments(args.slice(2));
  if (segments.length === 0 || segments.length > 3) {
    return { ok: false, message: REGISTER_USAGE };
  }

  const characterName = segments[0]?.trim();
  if (!characterName) {
    return { ok: false, message: REGISTER_USAGE };
  }

  const className = segments[1]?.trim();
  const spec = segments[2]?.trim();

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      characterName,
      ...(className ? { className } : {}),
      ...(spec ? { spec } : {}),
      ...(facultyId.value !== undefined ? { facultyId: facultyId.value } : {})
    }
  };
}

function parseOptionalFacultyId(token: string | undefined): ParseResult<number | undefined> {
  const normalized = token?.trim().toLowerCase();
  if (!normalized || ["none", "no", "-", "null", "без", "нет"].includes(normalized)) {
    return {
      ok: true,
      value: undefined
    };
  }

  return parsePositiveInteger(token, "facultyId должен быть положительным целым числом или none.");
}

function splitSegments(tokens: readonly string[]): string[] {
  return tokens.join(" ").split("|").map((segment) => segment.trim());
}

function formatRegistrationOptions(alliances: readonly RegistrationAllianceView[]): string {
  if (alliances.length === 0) {
    return "Ролевые для регистрации пока не созданы.";
  }

  return [
    "Доступная регистрация:",
    ...alliances.map((alliance) => {
      const faculties = alliance.faculties.length > 0
        ? alliance.faculties.map((faculty) => `#${faculty.id} ${faculty.symbol} ${faculty.name}`).join(", ")
        : "нет, используйте none";

      return `#${alliance.id} ${alliance.name} (${alliance.slug}): ${faculties}`;
    })
  ].join("\n");
}

function formatRegisteredPlayer(player: RegisteredPlayerView): string {
  const lines = [
    `Игрок зарегистрирован: ${player.characterName}`,
    `Telegram: ${player.displayName} (${player.telegramId.toString()})`
  ];

  if (player.className) {
    lines.push(`Класс: ${player.className}`);
  }

  if (player.spec) {
    lines.push(`Спек: ${player.spec}`);
  }

  if (player.activeAlliance) {
    lines.push(`Ролевая: #${player.activeAlliance.id} ${player.activeAlliance.name}`);
  }

  if (player.faculty) {
    lines.push(`Факультет: #${player.faculty.id} ${player.faculty.symbol} ${player.faculty.name}`);
  }

  return lines.join("\n");
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Ошибка: ${error.message}`;
  }

  return "Ошибка: не удалось выполнить команду.";
}
