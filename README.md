# Telegram Magomir Central Bank

Чистый TypeScript-проект Telegram-бота для банковской системы ролевых.

## Что заложено

- Telegram-first архитектура на `grammY`.
- Prisma + SQLite по умолчанию, готово к замене datasource.
- Без функционала жетонов, s-coins и мониторов.
- Единая доменная политика лимитов для СБП и покупок в магазине.
- Локальные лог-чаты и mirror-привязки в темы суперадминского лог-чата.
- Аудит успешных админ-действий в `admin`-логах ролевой.

## Структура

- `src/domain` - чистая бизнес-логика без Telegram и Prisma.
- `src/application` - сценарии и сервисы, которые оркестрируют домен и БД.
- `src/infrastructure` - Prisma и Telegram-адаптеры.
- `src/bot` - команды и middleware Telegram-бота.

## Запуск

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Рекомендуемый Node.js: 22 LTS. На Node 25 Prisma schema engine может падать при применении SQLite-схемы.

## Команды админа

```text
/bind_log <allianceId> <type> <chatId> [topicId] [title]
/bind_super_log <sourceTargetId> <superChatId> <topicId> [title]
/set_sbp_limit <allianceId> <currencyId|all> <minAmount> <maxAmount> <periodAmountLimit|none> <period>
/set_item_limit <itemId> <minQty> <maxQty> <periodQtyLimit|none> <period>
/create_alliance <slug> <name>
/create_currency <allianceId> <symbol> <name>
/add_member <allianceId> <telegramId|reply> [member|bank_admin|super_admin]
/set_balance <allianceId> <currencyId> <telegramId|reply> <amount>
/create_shop <allianceId> <name>
/create_item <shopId> <currencyId> <price> <stock|none> <name>
/hide_shop <shopId>
/show_shop <shopId>
/hide_item <itemId>
/show_item <itemId>
/adjust_balance <allianceId> <currencyId> <telegramId|reply> <+/-amount> [comment]
/profile [telegramId|reply]
/balance <allianceId> [telegramId|reply]
/history <allianceId> [telegramId|reply] [limit]
/purchase_history <allianceId> [telegramId|reply] [limit]
/alliance_info <allianceId>
/shop <shopId>
/inventory [telegramId|reply]
/sbp <allianceId> <currencyId> <receiverTelegramId|reply> <amount> [comment]
/buy <itemId> <quantity>
/disable_log <targetId>
/enable_log <targetId>
```

Типы логов: `finance`, `progression`, `purchase`, `admin`, `security`, `system`.

Периоды лимитов: `unlimited`, `day`, `week`, `month`, произвольные длительности (`10d`, `2w`, `3month`), `until:2026-07-01`, `2026-06-01..2026-07-01`.

Права: глобальные админы из `ADMIN_TELEGRAM_IDS` могут всё. Команды управления конкретной ролевой также доступны участникам этой ролевой с ролью `BANK_ADMIN` или `SUPER_ADMIN`; `/create_alliance` и `/bind_super_log` остаются глобальными.
