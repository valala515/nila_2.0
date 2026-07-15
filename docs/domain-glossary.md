# Domain glossary

Единый словарь терминов проекта (CLAUDE.md §3, §9). Один термин — одно понятие;
новые слова добавляются сюда по мере кристаллизации, старые не переименовываются
без ревью этого файла.

| Термин | Значение | Где в коде |
|---|---|---|
| **Turn** | Одна реплика пользователя (текст или транскрибированный голос) с оценённым тоном | `domain/turnRecord.ts` |
| **Tone label** | Эмоциональный тон одной реплики (`calm/stressed/anxious/sad/frustrated/positive/neutral`) — сигнал только для стиля ответа, не для содержания решений | `domain/toneLabel.ts` |
| **Interview session** | Статус диалога с пользователем (`not_started/in_progress/awaiting_confirmation`) | `domain/interviewSession.ts` |
| **Interview profile** | Накопленное по всем ходам пользователя состояние интервью: поля + открытые нити | `domain/interviewProfile.ts` |
| **Profile field** | Одна единица собираемой информации (например `mainConcern`) со статусом, значением, уверенностью и цитатой-доказательством | `domain/interviewProfile.ts` |
| **Field status** | `known` — подтверждено и сохранено; `missing` — ещё не обсуждалось; `deferred` — пользователь сознательно пропустил | `domain/interviewProfile.ts` |
| **Open thread** | Тема, которую пользователь затронул, но не раскрыл до конца — источник следующего уточняющего вопроса | `domain/interviewProfile.ts` |
| **Interview engine** | LLM-порт, который по последнему ответу пользователя обновляет поля профиля и генерирует следующий вопрос | `application/ports/interviewEnginePort.ts` |
| **Correction path** | Механизм: новое значение конфликтует с уже `known`-полем → не перезаписывается молча, следующий вопрос — подтверждение/исправление | `domain/interviewProfile.ts` (`applyInterviewUpdate`) |
| **Analytics event** | Структурированная запись о продуктовом событии (`events` таблица) — только категории/числа/ключи полей, никогда raw text (CLAUDE.md §5) | `application/ports/analyticsEventPort.ts`, `infrastructure/sqlite/analyticsEventRepository.ts` |
| **Funnel step** | Единица drop-off анализа интервью — либо `turnNumber` (какой по счёту ход), либо `fieldKey` (какая тема/поле профиля); оба выводятся из одного события `interview_turn_answered`, без двойного инструментирования | `application/useCases/getDashboardMetrics.ts` |
| **Felt heard score** | Оценка 1–5, которую пользователь даёт сразу после первого входа в фазу `synthesis` — единственная core-метрика WOW, не зависящая от ещё не построенных фич (avatar reveal, 48h-цикл) | `application/useCases/collectInterviewFeedback.ts` |
| **Conversation / Session** | Один непрерывный заход пользователя в интервью — от `/start` или reset до следующего `/start`/reset того же пользователя. Первого класса сущность (таблица `sessions`), не производная от `turns` | `application/ports/sessionPort.ts`, `infrastructure/sqlite/sessionRepository.ts` |
| **Session reset (soft)** | Тестовый инструмент дашборда: открывает новую сессию (`SessionPort.openNewSession`) — следующий ход в Telegram выглядит как новый разговор, но прошлая сессия и её `turns`/`bot_messages`/`events` остаются в SQL как отдельный завершённый разговор (виден в таблице разговоров) | `application/useCases/manageUserHistory.ts` (`resetUserSession`) |
| **History delete (hard)** | Необратимое удаление всех строк пользователя (`turns`/`profiles`/`events`/`sessions`/`bot_messages`) из SQL — для полной очистки тестового аккаунта, в отличие от soft reset ничего не остаётся | `application/useCases/manageUserHistory.ts` (`deleteUserHistory`), `infrastructure/sqlite/userResetRepository.ts` |
| **Bot message** | Реплика бота, зафиксированная сразу после отправки пользователю (вопрос интервью, checkpoint-отражение, felt-heard опрос/благодарность, приветствие) — парный к `Turn` источник для транскрипта разговора | `infrastructure/sqlite/sessionRepository.ts` (`recordBotMessage`), таблица `bot_messages` |
| **Transcript** | Полный обмен одной сессии — `turns` (роль user) и `bot_messages` (роль assistant), слитые по времени — то, что показывает drawer таблицы разговоров в дашборде | `application/ports/conversationsQueryPort.ts` (`getTranscript`) |

Соответствие со сводом (`docs/input/...`): «completeness map» свода = множество
`ProfileField.status` по всем полям; «open threads» — как в своде, без изменений.
