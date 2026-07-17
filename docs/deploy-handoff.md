# Деплой: хэндофф для backend-лида

## Что уже есть

- `Dockerfile` — multi-stage: сборка (`tsc` + `dashboard/` Vite-проект) → рантайм-образ
  только с `dist/`, prod `node_modules`, `miniapp/public`, `dashboard/dist`.
- `docker-compose.yml` — один сервис, порт `3001`, volume `nila-data:/app/data`
  (SQLite-файл переживает пересоздание контейнера).
- `.dockerignore` — исключает `node_modules`, `dist`, `data/`, `.env*`.
  **`.git` намеренно не исключён** — `scripts/generateVersion.mjs` берёт из него
  commit count/sha для `BUILD_VERSION`, который уходит в Sentry/GlitchTip как
  `release` (см. `CLAUDE.md` §10). Без git-истории билд всё равно соберётся
  (graceful fallback на `unknown`), но трейсинг деплоя по коммиту потеряется.

## Как поднять

```bash
cp .env.example .env   # заполнить секреты (см. ниже)
docker compose up -d --build
```

Бот стартует на long polling (не webhook) — исходящих открытых портов от
Telegram не требует. Порт `3001` нужен только для Mini App API
(`/api/profile`) и дашборда.

## Обязательные переменные в `.env`

`TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `DASHBOARD_TOKEN` — без них процесс не
стартует (`src/config/env.ts` валидирует через Zod при старте). Остальное —
дефолты из `.env.example`, кроме:

- `TELEGRAM_WEBAPP_URL=https://nila.newmindstart.com` — постоянный домен вместо
  текущего временного `cloudflared`-туннеля (см. `docs/sprint-plan.md`,
  раздел «Открытые решения» → Деплой).
- `GLITCHTIP_DSN` — прод-DSN из GlitchTip (`app.glitchtip.com`, орг
  `newmindstart`), если ещё не заведён отдельный prod-проект.

## Домен

**`nila.newmindstart.com` → сервер, где крутится контейнер, порт `3001`.**

TLS-терминацию и reverse proxy (Nginx/Caddy/Traefik или LB хостинг-платформы)
этот репозиторий не задаёт — контейнер отдаёт голый HTTP на `3001`, это зона
ответственности backend-инфры. Единственное жёсткое требование: у Telegram
`web_app` должен быть настоящий `https://`, самоподписанный сертификат не
подходит.

## Не забыть

- `DATABASE_PATH` внутри контейнера всегда `./data/nila.sqlite` (volume
  `nila-data` смонтирован в `/app/data`) — не менять на путь вне volume,
  иначе SQLite-файл потеряется при пересборке.
- После переезда на постоянный домен — обновить Menu Button
  (`bot.api.setChatMenuButton`) и проверить `bot.api.getChatMenuButton()`
  реально отдаёт `web_app`, а не `default` (как делали на этапе с туннелем).
