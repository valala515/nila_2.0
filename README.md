# nila_2.0

Nila AI / The You Who Made It — Telegram-first wellness companion.

## Quick start

```bash
corepack enable                 # один раз на машине — включает pnpm по packageManager из package.json
cp .env.example .env            # заполнить TELEGRAM_BOT_TOKEN и OPENAI_API_KEY
pnpm install                    # поставит зависимости + husky-хуки (см. prepare)
pnpm run dev                    # запуск в watch-режиме
```

Правила работы с кодом и архитектурой — см. [CLAUDE.md](CLAUDE.md).
