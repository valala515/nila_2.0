# Nila AI / The You Who Made It — Sprint-план v0.3

**Внутренний Telegram MVP · проверено и скорректировано Claude Code во время разработки**
Источник: `docs/input/Nila_AI_The_You_Who_Made_It_8_week_sprint_plan_v0.2.pdf` (13 июля 2026)
Этот документ: 8 недель, 14 июля — 4 сентября 2026. Живой — обновляется по ходу спринтов, не пишется один раз и забывается.

## Как читать этот документ

Структура v0.2 сохранена (WOW-точки, риски, Definition of Done, gates) — она была продуманной. Добавлено:
статус по каждому пункту (что реально сделано на сегодня) и раздел «Что скорректировал Claude Code» — места,
где реализация разошлась с планом или вскрыла решение, которое v0.2 не проговаривал явно.

**Легенда статусов:** ✅ сделано · 🔶 частично / сделано иначе, чем в плане · ⬜ не начато · ⚠️ решение нужно принять

---

## Обзор по неделям

| W | Даты | Релиз | Статус |
|---|---|---|---|
| 1 | 14–17 июл | Telegram + adaptive voice interview | 🔶 в работе — инфраструктура, движок интервью и voice benchmark опережают план, E2E dogfood ещё не начат |
| 2 | 20–24 июл | Interview quality + hidden completeness | ⬜ не начат |
| 3 | 27–31 июл | The You Who Made It (selfie → avatar reveal) | ⬜ не начат |
| 4 | 3–7 авг | 48-hour best-friend loop + NMS | ⬜ не начат |
| 5 | 10–14 авг | Optional health-data intake | ⬜ не начат |
| 6 | 17–21 авг | Wearable Gateway v1 | ⬜ не начат |
| 7 | 24–28 авг | Specialist agents + evidence + doctor handoff | ⬜ не начат |
| 8 | 31 авг–4 сен | Closed loop + hardening | ⬜ не начат |

**Core WOW MVP** — после Week 4 (интервью + Future You + 48h action без gadgets).
**Data-enriched MVP** — после Week 8.

---

## Что скорректировал Claude Code (v0.2 → v0.3)

Не косметика — десять мест, где либо реализация уже разошлась с планом, либо план предполагал решение,
которое ещё не принято явно.

**1. Webhook → long polling.** V0.2 закладывает Telegram Bot API + webhook. Текущее dev-окружение — sandbox
без публичного inbound HTTPS, поэтому бот подключён через grammY на long polling.
*Почему это важно:* long polling полностью закрывает Weeks 1–5, но Week 6 (WHOOP webhooks) сама требует
входящий HTTPS-эндпоинт — это нельзя обойти long polling'ом на стороне провайдера данных.
*Что делать:* решение по деплою (публичный домен/reverse proxy или Cloud Run/Tasks) нужно принять не позже
начала Week 6, не в последний день.

**2. STT выбран без запланированного бенчмарка — закрыто 16 июля.** V0.2 требовал benchmark OpenAI
gpt-4o-transcribe vs Deepgram Nova-3 Medical на 20–30 gold-клипах, критерий — Critical Fact Recall
(отрицания, дозы), а не WER. По факту: 15 июля пользователь подтвердил готовый OpenAI-ключ, адаптер выбран
без сравнения; сравнение с Deepgram отдельно снято с повестки в тот же день (см. «Открытые решения»).
Retrospective Critical Fact Recall на 24 golden-клипах проведён 16 июля — 95.8%/100% в двух чистых прогонах,
negation/dose 100% в каждом. Задокументировано в `docs/adr/0003-stt-vendor-openai.md` (не `0002` — этот номер
уже занят `conversation-history-and-caching-strategy`), включая два реальных бага, найденных по пути
(hardcoded `.ogg`-расширение в адаптере, `\b`-граница в матчере фактов).

**3. Место репозитория в архитектуре не решено.** V0.2 предполагает «один backend Neoly/Nila AI, одна БД,
отдельный wellness-модуль» — то есть этот бот должен встраиваться в существующий backend. По факту
`nila_2.0` — новый самостоятельный repo с собственным hexagonal-скелетом (`domain/application/infrastructure/
transport`) и локальной SQLite, без связи с Neoly.
*Почему это важно:* Week 5 («current stack») и Week 6 («current backend endpoint») в v0.2 буквально ссылаются
на существующий backend, которого в этом repo нет.
*Что делать:* явное решение нужно до Week 5 — либо `nila_2.0` остаётся самостоятельным сервисом и Weeks 5–8
переписываются под него, либо происходит миграция/интеграция в Neoly до этой точки. Сейчас это открытый
вопрос, не тихое допущение.

**4. Tone-tagging ≠ tone profile.** Сегодня реализована posturn-классификация тона реплики LLM'ом по тексту
(`calm/stressed/anxious/sad/frustrated/positive/neutral`) — она не была в плане Sprint 1 явно, но полезна как
сырой сигнал. Week 4 требует другой артефакт: tone profile (direct/warm, preferred name, sensitive themes,
shame triggers), синтезированный из всего интервью, а не из одной реплики.
*Что делать:* не считать сегодняшнюю работу частью Week 4 — это входной сигнал для будущего Profile
Synthesizer, не замена ему.

**5. Anti-bloat tooling — уже впереди плана.** ESLint hard limits, dependency-cruiser (граница
domain/application/infrastructure/transport), husky pre-commit — работают с первого коммита, а не как
рекомендация из раздела 9 v0.2. Изменений не требует, отмечено как единственный пункт, где реальность лучше
плана.

**6. Allowlist и структурированные events отсутствуют.** V0.2 (Tue 14 Jul) включает allowlist и event names
как часть Foundation. По факту: бот отвечает любому пользователю Telegram, событий как таковых (только
`console.error` на unhandled) нет.
*Почему это важно:* продукт работает с health-данными; отсутствие allowlist на dev-боте с реальными людьми —
не блокер на 1 внутреннего тестера, но становится риском по мере роста числа тестеров в Sprint 1 Fri
dogfood.
*Что делать:* добавить allowlist (по `chat.id`) до подключения второго/третьего внутреннего тестера.

**7. Мониторинг ошибок пришёл на 7 недель раньше плана.** V0.2 относит "Sentry/monitoring" к Week 8
(hardening). По факту GlitchTip (`@sentry/node`) подключён уже в Day 1
(`src/infrastructure/monitoring/errorTracker.ts`), `sendDefaultPii` выключен, `BUILD_VERSION` передаётся как
`release`, DSN опционален (graceful degradation при пустом `GLITCHTIP_DSN`).
*Почему это важно:* не риск, а плюс — необработанные ошибки долетают до GlitchTip/Slack с первого дня, не
только с Week 8.
*Что делать:* действий не требует; при подключении второго/третьего тестера стоит завести отдельный alert
routing, не дожидаясь Week 8.

**8. npm → pnpm.** Тулинг сменён на pnpm (14 июля) — решение уровня repo, не было предметом v0.2.
*Почему это важно:* не влияет на roadmap продукта.
*Что делать:* без действий сейчас; если pnpm столкнётся с CI/Docker-специфичным поведением — короткий ADR.

**9. Interview engine — Thu-скоуп сделан во Tue, Wed-скоуп (voice benchmark) не начат.** Реальный порядок
работ внутри Sprint 1 разошёлся с v0.2 не по неделям, а по дням: State Update schema (ad hoc, Zod),
completeness map, open threads, next-question prompt и correction-path код — весь скоуп, запланированный на
Thu 16 Jul — в основном реализован в коммите Tue 14 Jul (`9c6f76e`). При этом Wed 15 Jul (voice benchmark)
пока не сдвинулся с места.
*Почему это важно:* Definition of Done для Thu теперь ближе к выполнению, чем выглядит по календарю; но
есть риск, что voice benchmark (важен для Critical Fact Recall, корректировка №2) отложится ещё дальше, если
фокус останется на профиле интервью.
*Что делать:* явно принять, что Wed/Thu календарь v0.2 внутри Sprint 1 не обязателен буквально по дням —
важен весь скоуп к Fri dogfood, не порядок. Voice benchmark стоит вернуть в фокус до Fri, параллельно с
доработкой correction path.

**10. Correction path: код есть, эффект — нет (ручной тест 14 Jul) — закрыто.** `applyInterviewUpdate` и
`buildContradictionQuestion` реализованы и должны превращать конфликтующее known-поле в уточняющий вопрос
вместо молчаливой перезаписи. На ручном тесте пользователь намеренно дал два противоречащих друг другу
утверждения — уточняющий вопрос не появился.
*Гипотеза причины (не подтверждена логами):* (a) contradiction засчитывается только при точном текстовом
несовпадении `incoming.value !== existing.value` — но оба значения генерируются LLM-парафразом независимо в
разных ходах, поэтому противоречивые по сути ответы легко совпадают текстуально; (b) contradiction также
требует `confidence >= 0.6` у нового значения — модель не обязана держать высокую уверенность именно в
момент, когда сама переоценивает предыдущий ответ; (c) промпт (`interviewEngine.v1.md`) ссылается на
"explicit contradiction (see below)", но раздела "below" в тексте промпта нет — модели неоткуда взять
инструкцию, как вести себя на этапе extraction при обнаруженном противоречии; весь contradiction-handling
сейчас держится только на доменной функции, а не на инструкции модели.
*Сделано:* все три пункта из плана 15 июля реализованы: (1) `prompts/interviewEngine.v4.md` содержит
эксплицитный раздел про contradiction ("judge by meaning, not by wording"); (2) модель сама проставляет
`isContradiction: true/false`, string-diff остался только страховочным fallback; (3)
`tests/unit/interviewProfile.test.ts` покрывает оба пути (engine-флаг и текстовый fallback) реальными
противоречащими формулировками, не идентичными строками.

---

## Sprint 1 — сокращённая неделя (14–17 июля)

Цель: один тонкий end-to-end срез voice/text → context-aware question → structured draft profile.
Никаких аватаров и wearables.

| День | Фокус | План v0.2 | Статус |
|---|---|---|---|
| Tue 14 Jul | Foundation | CLAUDE.md, ADR, bot/webhook, allowlist, migrations, event names, smoke test | 🔶 |
| Wed 15 Jul | Voice benchmark | 20–30 gold clips, OpenAI vs Deepgram, keyterms, latency/cost logging, выбрать STT | ✅ (16 Jul, синтетические клипы вместо записей людей) |
| Thu 16 Jul | Interview engine | State Update schema, completeness map, open_threads, next-question prompt, correction path | 🔶 (сделано на 2 дня раньше, во Tue) |
| Fri 17 Jul | E2E dogfood | 3 внутренних пользователя, 5–7 turns, profile draft, sprint demo | ⬜ |

### Tue 14 Jul — Foundation

- ✅ `CLAUDE.md` — архитектура, hard limits, порядок работы
- ⬜ Architecture decision record — ни один ADR ещё не написан (нужен минимум по STT и по long polling)
- 🔶 Telegram bot — подключён и отвечает, но через **long polling**, не webhook (см. корректировку №1)
- ⬜ Allowlist — отсутствует (см. корректировку №6)
- ✅ Migrations — таблица `turns` создана и используется (`src/infrastructure/sqlite/db.ts`)
- ⬜ Event names — структурированной событийной схемы нет, только `console.error`
- ✅ Smoke test — `/start` + echo проверены вручную в реальном Telegram
- ✅ (доп., не было в исходном чек-листе Tue) Interview engine — контекстно-зависимые вопросы,
  correction-path код, `/profile` completeness map; это Thu-скоуп v0.2, сделан на 2 дня раньше (см.
  корректировку №9)
- ✅ (доп.) GlitchTip error tracking подключён (см. корректировку №7)
- ✅ (доп.) `docs/domain-glossary.md` заведён

### Wed 15 Jul → 16 Jul — Voice benchmark

- ✅ 24 golden-клипа (`tests/contract/fixtures/sttGoldenSet.json`) — синтетические (ElevenLabs TTS,
  независимо от тестируемого OpenAI STT), не 20–30 записей людей — компромисс ради скорости, см.
  `docs/adr/0003-stt-vendor-openai.md`
- ➖ **Решено 15 Jul: вендор — OpenAI, сравнения с Deepgram не будет.** Ключ уже в `.env`
  (`OPENAI_API_KEY`), адаптер работает.
- ✅ Retrospective Critical Fact Recall на golden-наборе — 95.8%/100% в двух чистых прогонах,
  negation/dose 100% в каждом (`pnpm run stt:benchmark`, `docs/adr/0003-stt-vendor-openai.md`). По пути
  найдены и исправлены два реальных бага: hardcoded `.ogg`-расширение в `speechToText.ts` (валило non-ogg
  аудио) и `\b`-граница в матчере (не матчила фразы, оканчивающиеся не-словесным символом, `"40%"`)
- ✅ Glossary/keyterms в STT-запросе — `src/domain/sttGlossary.ts` + `prompt`/`language: 'en'` в
  `speechToText.ts` (черновой список терминов, расширяется по мере dogfood)
- ✅ Latency/cost logging по STT-вызовам — уже было реализовано на момент написания этого пункта
  (`stt_call_completed` → `getCostPerCompletedSession`), просто не отражено в предыдущей версии этого файла
- 🔶 STT-адаптер выбран и работает (`gpt-4o-transcribe`), решение по-прежнему принято по готовности ключа, но
  теперь дополнительно подтверждено retrospective-бенчмарком (см. корректировку №2)

### Thu 16 Jul — Interview engine (сделано во Tue, на 2 дня раньше)

- 🔶 State Update schema (JSON, строгая) — есть Zod-схема одного LLM-вызова
  (`fieldUpdates/openThreads/nextQuestion/flaggedForReview`, `src/infrastructure/openai/interviewEngine.ts`),
  но это не отдельный State Updater промпт из v0.2 Sprint 2 — компромисс тонкого среза
- ✅ Completeness map (known/missing/deferred) — статус `ProfileField.status`, видно через `/profile`
- ✅ Open threads — реализовано, engine пересчитывает список целиком на каждом ходу
- ✅ Next-question prompt — реализовано, Socratic follow-up на открытую нить/missing-поле вместо echo
- 🔶 Correction path — доменная логика есть (`applyInterviewUpdate` + `buildContradictionQuestion`), но по
  факту ручного теста 14 Jul работает ненадёжно (см. корректировку №10) — приоритет на 15 июля

### Ручное тестирование 14 Jul (внутренний QA, вручную в Telegram)

- ✅ Context retention — next-question явно ссылается на открытую нить/детали предыдущего ответа, не общий
  вопрос "в лоб"
- ✅ Вежливый тон при грубости/мате пользователя — правило промпта "never mirror tone, never moralize"
  сработало на реальной грубой реплике
- ❌ Contradiction → уточняющий вопрос — не сработало на противоречащих друг другу утверждениях; см.
  корректировку №10 (гипотеза причины + план на сегодня)

### Fri 17 Jul — E2E dogfood

- ⬜ 3 внутренних пользователя × 5–7 turns — пройден 1 пользователь, 2 реплики (текст + голос), не интервью
- ⬜ Structured profile draft — не начато (нет State Updater)
- 🔶 Review logs — сделана ручная проверка SQLite (`SELECT ... FROM turns`), не формальный review
- 🔶 Sprint demo в Telegram — неформально показано через скриншоты, не полноценное demo интервью

**Пройдено раньше графика (не было явно в Sprint 1 v0.2):** голосовые сообщения OGG → transcript end-to-end
(планировались на Wed), posturn tone-tagging через LLM, сохранение каждой реплики (текст и голос) в SQLite с
userId/каналом/тоном/временем.

### Definition of Done (из v0.2, со статусом)

- 🔶 Voice и text идут в один interview state — да (`turns`), но нет шага «посмотреть/исправить transcript до
  сохранения факта»
- ✅ Каждый следующий вопрос явно следует открытой нити предыдущего ответа
- ✅ Обязательные поля имеют статус known/missing/deferred (сам список полей ещё черновой, см. «Открытые
  решения»)
- ✅ Нет ошибок отрицания/доз на golden-наборе (24 клипа, 95.8%/100% recall в двух прогонах, negation/dose
  100% в каждом — `docs/adr/0003-stt-vendor-openai.md`); low-confidence contradiction-механизм отдельно
  описан в корректировке №10
- ⬜ После 5–7 turns виден structured draft
- 🔶 Raw text не идёт в console/observability (SPEC в `processUserUtterance.ts` явно это запрещает) ✅;
  cost/latency events по STT пишутся (`stt_call_completed`) ✅, по tone-анализу — нет ⬜

---

## Sprint 2 (Week 2, 20–24 июл) — Interview quality + hidden completeness

**Риск: H** · Статус: ⬜ не начат

| | |
|---|---|
| Видимый результат | 8–12-turn voice-first интервью, звучит как разговор, собирает подтверждаемый health profile |
| Что реализуем | Prompt pack (Interviewer, State Updater, Completeness Checker, Profile Synthesizer, Safety Boundary); два слоя памяти (factual + narrative); уточняющие вопросы по открытым нитям; Confirm/Correct/Skip; базовый crisis-route; 20 synthetic scenarios + 5 internal interviews |
| Инструменты | Claude Sonnet 5 + strict tool schema, Zod validation, versioned prompts в репозитории, offline evaluator rubric |
| Готово, когда | 4/5 тестеров "felt understood" ≥4/5 · ≥90% обязательных полей known/deferred · нет повторных/противоречивых вопросов · correction меняет следующий вопрос и итоговый profile |

**Заметка Claude:** зависит от корректировки №2 (STT retrospective-бенчмарк) — если Critical Fact Recall
на OpenAI окажется слабым именно на отрицаниях/дозах, это Definition of Done этой недели не пройдёт, а не
абстрактный риск.

---

## Sprint 3 (Week 3, 27–31 июл) — The You Who Made It: selfie → reveal

**Риск: H** · Статус: ⬜ не начат

| | |
|---|---|
| Видимый результат | Через 60–90 минут после интервью — узнаваемый same-age avatar + персональное сообщение от первого лица |
| Что реализуем | Selfie consent + upload + quality check; avatar brief из цели/tone без raw medical transcript; benchmark 10 selfies FLUX.2 Pro vs Gemini 3.1 Flash Image; reject/regenerate; durable scheduled job с retry/idempotency; message template recognition→acceptance→promise→evidence |
| Инструменты | FLUX.2 Pro / Gemini 3.1 Flash Image, object storage с TTL, Postgres scheduled_messages + worker, version registry |
| Готово, когда | 4/5 узнают себя и принимают образ · возраст/этничность/черты не изменены · нет автоомоложения/изменения веса · reveal приходит вовремя даже после restart · selfie/output можно удалить |

**Заметка Claude:** текущий стек — SQLite + Node-процесс без durable job runner. "Durable scheduled job,
переживающий restart/deploy" (и здесь, и в Week 4/7) — отдельная инфраструктурная задача, которую v0.2
упоминает вскользь в разделе 2 ("Durable scheduler"), но не выделяет как отдельную работу. Стоит явно
заложить время на неё в начале этой недели, а не считать побочным продуктом остального.

---

## Sprint 4 (Week 4, 3–7 авг) — WOW #3: Future You как лучший друг + one NMS action

**Риск: H** · Статус: ⬜ не начат

| | |
|---|---|
| Видимый результат | Через ~48 часов Future You возвращается как голос самого пользователя: принимает контекст, предлагает одно мягкое действие |
| Что реализуем | Tone profile из интервью (direct/warm, preferred name, sensitive themes, shame triggers); 48h message acknowledgement→permission→action→why; curated NMS set 20-30 практик; правила 3/7/12 мин, no athlete language; Done/Later/Not today/Not for me; action outcome меняет следующее сообщение |
| Инструменты | Existing NMS catalog + deterministic metadata mapping, Claude message generator с bounded template, durable scheduler, event analytics |
| Готово, когда | Сообщение содержит реальный контекст, но не звучит creepy · ≥3/5 отвечают/принимают action · action не требует перестроить жизнь · пропуск не вызывает guilt |

**Заметка Claude:** это точка, где сегодняшний posturn tone-tagging становится полезен — но только как один из
входных сигналов для настоящего tone profile (см. корректировку №4), не как готовая замена Profile
Synthesizer.

**Заметка Claude (lesson-level match, зафиксировано 2026-07-17):** сейчас движок рекомендаций
(`src/domain/courseRecommendation.ts`) знает, что урок совпал с запросом, но теряет, какой именно.
`matchVariantGroup()` (строки 61-72) матчит lesson-tier против `haystacks.lessonText` —
склеенной через `course.lessonTitles.join(' ')` строки всех уроков курса (`buildHaystacks()`,
строка 48) — и возвращает только факт совпадения (`points: 0.4, isTopTier: false`), без индекса
урока. Сами названия при этом не урезаны и доступны полностью: `Course.lessonTitles: string[]`
заполняется из `sections[].lessons[].title` при синке (`courseMapper.ts:39-44`,
`extractLessonTitles()`) и лежит в БД (`lesson_titles_json`, `sqlite/courseRepository.ts`) —
досинкать с NMS ничего не нужно, это чисто domain-слой доработка.

Что нужно для «курс не подходит целиком, но урок №3 точно по запросу»:
1. `matchVariantGroup()` — при lesson-tier матче искать по отдельным элементам
   `course.lessonTitles`, не по склеенной строке, и вернуть индекс/название совпавшего урока.
2. `TierMatch`/`CourseMatch` (там же) — добавить опциональное поле вроде
   `matchedLessonTitle?: string`.
3. `rankCourses()` — сейчас возвращает голый `Course[]` (последняя строка функции,
   `.map(({ course }) => course)`); нужно возвращать `{ course, matchedLessonTitle? }[]` (новый
   тип, например `ScoredCourse`), чтобы вызывающий код мог сослаться на конкретный урок, а не
   только на курс целиком.
4. `application/useCases/recommendCourses.ts` — пробросить новый тип наружу без изменений в
   инфраструктуре/портах.

**Зачем именно к этому спринту:** "why"-часть 48h-сообщения (acknowledgement→permission→action→why)
станет конкретнее — не «этот курс про stress», а «урок "X" в этом курсе прямо отвечает на то, что
ты написала». Не блокирует старт Sprint 4, но если "why" должен быть предметным, а не generic —
логично сделать эту доработку перед или вместе с message-generator частью спринта, не откладывать
дальше. Полный контекст (пример: `pnpm run courses:sync` дал 404 English-курса 2026-07-16, движок
уже отранжирован по known-good regression-кейсам) — см. память `project_course_catalog_ported`.

---

## Sprint 5 (Week 5, 10–14 авг) — Optional health-data intake v1

**Риск: H** · Статус: ⬜ не начат

| | |
|---|---|
| Видимый результат | Lab PDF/photo, voice/photo текущего stack и (stretch) genome file делают profile точнее, не блокируя опыт без данных |
| Что реализуем | Digital PDF → text, scan/photo → OCR; строгая lab schema (test/value/unit/range/date/confidence/raw line); stack (substance/dose/timing/reason/prescriber) → confirm; genome — только curated 20-30 variants (stretch); каждый факт с source+confidence+Confirm/Edit/Reject |
| Инструменты | PyMuPDF, Google Document AI OCR + quality score, Claude strict extraction, deterministic genome parser + Ensembl VEP/ClinVar, Telegram file intake |
| Готово, когда | 3 разных lab-документа без silent decimal/unit error · low-confidence никогда не входит в active profile без confirm · stack исправляется voice/text · genome не блокирует неделю |

**Заметка Claude:** зависит от корректировки №3 (место репозитория в архитектуре) — "current stack" в v0.2
подразумевает существующие данные пользователя в Neoly backend; в самостоятельном `nila_2.0` это нужно либо
собирать с нуля, либо явно интегрироваться.

---

## Sprint 6 (Week 6, 17–21 авг) — Wearable Gateway v1 + data-aware proactivity

**Риск: H** · Статус: ⬜ не начат

| | |
|---|---|
| Видимый результат | Внутренний тестер подключает WHOOP; Future You использует sleep/recovery данные, переводя их в мягкий режим дня, а не athlete score |
| Что реализуем | Provider adapter interface + normalized schema; direct WHOOP OAuth, backfill, v2 webhooks, idempotency, freshness; поля sleep/HRV/RHR/recovery/strain; source/timestamp видимы; stale data блокирует вывод; 1-day spike Junction vs Terra |
| Инструменты | WHOOP API + webhooks, current backend endpoint + scheduler, normalized daily_metrics |
| Готово, когда | Реальные WHOOP-данные видны в Telegram · повторный webhook не создаёт дубликат · одно проактивное сообщение использует реальные данные · нет device = self-report fallback, не сломанный flow |

**Заметка Claude:** это неделя, где корректировка №1 (long polling → webhook) становится жёстким требованием,
а не выбором. WHOOP webhooks требуют публичный HTTPS-эндпоинт независимо от того, как принимает сообщения
сам Telegram-бот. Решение по деплою нужно закрыть до начала этой недели.

---

## Sprint 7 (Week 7, 24–28 авг) — Specialist agents + evidence + doctor handoff

**Риск: H** · Статус: ⬜ не начат

| | |
|---|---|
| Видимый результат | Для high-impact вопроса система формирует одну объяснимую гипотезу, показывает missing data и готовит clinician-ready summary |
| Что реализуем | Relevant roles only (Women 50+, Men's Vitality, Family, Labs/Genome, Supplements/Peptides, Safety); Round A независимые мнения, Round B только при конфликте; coordinator возвращает одно finding/uncertainty/next step; PubMed evidence tool + strength label; кандидатная гипотеза БАД/пептид без автономного старта; manual doctor approve/modify/reject |
| Инструменты | Claude tool use со строгими schemas, PubMed E-utilities, versioned agent prompts, простая admin-страница или Telegram clinician buttons, `protocols`/`agent_reports` в Postgres |
| Готово, когда | Один internal case проходит data→hypothesis→objections→coordinator→clinician decision · решение врача меняет state · нет "начните принимать" без human gate · output помещается в один экран |

---

## Sprint 8 (Week 8, 31 авг–4 сен) — Action → data → conclusion + hardening

**Риск: M** · Статус: ⬜ не начат

| | |
|---|---|
| Видимый результат | Nila/Future You меняет следующий шаг на основании поведения, feedback и доступных данных пользователя |
| Что реализуем | State lifecycle offered→accepted→started→completed/stopped; feedback helped/unclear/did not help; pre/post windows для wearable/labs; prompt/model/version registry + cost dashboard; retry, idempotency, quiet hours, alert cap, deletion/export; 48-hour removal test |
| Инструменты | Postgres events/protocols/checkins, deterministic comparisons (без causal claim из одного дня), Sentry/monitoring + automated tests, Claude Code hooks (tests/lint/type-check) |
| Готово, когда | Core WOW flow переживает restart и retries · сообщение меняется после correction/action outcome · нет critical data extraction errors в golden set · команда называет конкретную потерю на removal test · Go/No-Go решение задокументировано |

---

## North-star и gates

| Метрика | Gate |
|---|---|
| Interview completion | ≥70% внутренних приглашённых заканчивают |
| Felt understood | ≥4/5 у 4 из 5 тестеров |
| Critical fact accuracy | Нет ошибок отрицания/дозы/возраста в golden set; исправления отслеживаются |
| Avatar acceptance | ≥4 из 5 узнают/принимают образ; нет нежеланного сдвига возраста/идентичности |
| 90-minute reveal | Доставлено вовремя; ≥60% open/reply в команде |
| 48-hour value | ≥3 из 5 отвечают, принимают action или явно называют полезным |
| Health-data quality | Ни один unconfirmed low-confidence факт не в active profile |
| Removal pain | Минимум 2 тестера называют конкретную потерянную пользу |

Маленькая выборка (3–5 внутренних тестеров) не даёт статистического доказательства — gates нужны для поиска
блокеров и product decision, не для объявления retention победой. После Week 4 нужен отдельный moderated
test с 5–8 женщинами 50+.

## Ресурсная оценка

| Ресурс | Минимум |
|---|---|
| Основной builder | 1 FTE, Claude Code, 8 недель |
| Product/UX/content | 0.3–0.5 FTE, особенно Weeks 2–4 |
| Medical reviewer | 2–4 ч/неделю с Week 5, обязателен с Week 7 |
| Internal testers | 3–5 человек, 2 full interviews/неделю |
| Target users | 5–8 moderated sessions после Core WOW MVP |

---

## Новый скоуп, открыт 16 июля — рейтинг вопросов, оценка опыта, показ профиля в Telegram

Не было в v0.2 явно. Три связанных запроса пользователя 16 июля, требующих архитектурного решения до
начала кода — зафиксировано здесь, а не как тихое допущение по ходу реализации.

**1. Оценка каждого вопроса (👍/👎).** Исследование Telegram Bot API: нативные message reactions
(`message_reaction` update) не годятся — бот не может быть администратором приватного 1:1-чата, поэтому
API-реакции реально работают только в группах/каналах, где бот назначен админом, не в личных сообщениях
(источник: [grammY Reactions guide](https://grammy.dev/guide/reactions)). Вместо этого — inline-кнопки 👍/👎
под каждым вопросом бота (`InlineKeyboard` + `bot.callbackQuery(...)` в grammY, уже используемый в проекте
фреймворк) — стандартный паттерн, работает в любом чате, не только в группах.

**2. Показ профиля пользователю в Telegram.** Два варианта: (a) форматированное текстовое сообщение
(HTML/MarkdownV2, секции по фазам catalog'а) — минимум инфраструктуры, работает уже сейчас на long polling;
(b) Telegram Mini App (`web_app` кнопка, полноценный HTML/CSS/JS интерфейс) — требует публичный HTTPS-домен
для `web_app` URL, то есть решение по деплою (корректировка №1, сейчас не позже Week 6) придётся принять
раньше срока искусственно, не по продуктовой необходимости.

**3. Оценка опыта в конце профиля + возможность отредактировать.** Естественная точка — переход в
терминальную фазу `synthesis` (Future You brief, см. `docs/nila-interview-mechanics` §07 "готово/отложено":
пока не реализована). Механика правки частично уже есть: `applyInterviewUpdate` + correction path из Sprint 1
(корректировка №10, закрыто). Рейтинг — inline-кнопки (например 👍/😐/👎), кнопка "Изменить" ведёт в
существующий correction-flow, не в новый.

**Решения, принято пользователем 16 июля:**
- ✅ Рейтинг вопроса — inline-кнопки 👍/👎 под каждым вопросом, **кроме** intro-демографики (age/gender/weight
  — короткие прямые вопросы, не Socratic follow-up).
- ✅ Профиль — **Telegram Mini App**, не форматированный текст. Это принятое решение против рекомендации
  Claude (текст был бы проще и не требовал бы HTTPS раньше срока) — пользователь явно предпочёл полноценный
  UI. Прямое следствие: публичный HTTPS-домен для `web_app` URL нужен **уже в Sprint 1/2**, не к Week 6 — это
  двигает корректировку №1 (webhook vs long polling) с "решить не позже Week 6" на "решить сейчас". `web_app`
  URL должен быть настоящим `https://`, самоподписанный сертификат/`http://localhost` не подходят — Telegram
  это не примет.
- ✅ Рейтинг опыта — по завершении всех 5 фаз (текущий конец собранных данных; при реализации `synthesis`
  экран рейтинга перемещается туда).

**Корректировка после живого теста в Telegram, тот же день (16 июля).** Прогнали реализацию через реальный
чат (dev-бот, `bot.handleUpdate()` не подходил — нужен был живой UI) и по результатам сузили скоуп:
- ❌ **Рейтинг каждого вопроса убран полностью** — 👍/👎 под каждым вопросом интервью оказались избыточны
  ("too much" — пользователь). Кнопок под обычными вопросами/checkpoint-отражением/уточнением при
  contradiction больше нет вообще, независимо от фазы.
- ✅ **Рейтинг опыта остаётся, но только 👍/👎** — 😐 (нейтрально) и кнопка "✏️ Edit something" убраны.
  Причина по "Edit": в живом тесте кнопка вела в правку профиля (`applyProfileEdit`), которая не смогла
  распознать простую правку ("I want to focus on my knee recovery" → "I didn't catch anything to update
  there") — фича признана нерабочей и одновременно необязательной, решено убрать целиком, а не чинить.
  `applyProfileEdit`/`handleUserMessage`-роутинг после `synthesis` удалены из кода.
- ✅ **Порядок кнопок фиксирован**: 👎 слева, 👍 справа (не порядок добавления по умолчанию).

Итог: единственные inline-кнопки в продукте — 👎/👍 под опросом "how did this conversation feel?" при входе
в `synthesis`. Дашборд-интеграция рейтинга вопросов (KPI-карточка, столбец в таблице разговоров, бейджи в
транскрипте) откачена вместе с фичей — не оставляем мёртвый UI под несуществующие данные.

---

## Открытые решения (нужен ответ, не тихое допущение)

- 🔶 **Деплой:** публичный HTTPS-эндпоинт нужен уже сейчас, не к Week 6 — Mini App для показа профиля
  (решение 16 июля, см. «Новый скоуп») требует настоящего `https://` для `web_app` URL. Код-часть закрыта
  17 июля (`verifyInitData`, `GET /api/profile`, `miniapp/public` статика, `bot.api.setChatMenuButton`, см.
  `immutable-shimmying-nest.md` Фаза B), и в тот же день поднят `cloudflared`-туннель
  (`https://outer-hung-skip-capable.trycloudflare.com` → `localhost:3001`); `TELEGRAM_WEBAPP_URL` в `.env`
  заполнен, Menu Button подтверждён через `bot.api.getChatMenuButton()` как реальный `web_app`, не `default`.
  Единственное, что осталось — ручной тап-тест на телефоне пользователя (не автоматизируется). Это
  временное решение: free quick tunnel без аккаунта, URL меняется при каждом перезапуске `cloudflared`,
  процесс не переживает перезагрузку/сон машины — постоянное решение (reverse proxy/Cloud Run) всё равно
  нужно не позже Week 6 из-за WHOOP webhooks, это не отменяется.
- ✅ **STT-вендор:** решено 15 Jul — OpenAI, без сравнения с Deepgram. Retrospective-бенчмарк Critical Fact
  Recall проведён 16 Jul, раньше начала Week 2 — закрыто, см. `docs/adr/0003-stt-vendor-openai.md`.
- ⚠️ **Место в архитектуре:** `nila_2.0` остаётся самостоятельным сервисом до конца MVP, или интегрируется в
  Neoly backend до Week 5?
- ⚠️ **Allowlist:** добавить до второго внутреннего тестера — кто входит в список?
- ⚠️ **Profile field catalog:** текущий `PROFILE_FIELD_CATALOG` (7 черновых полей в `intro`,
  `src/domain/interviewProfile.ts`) — временный. Продукт отдельно прорабатывает документ "цели по
  результатам интервью" (какая информация и зачем собирается) — ожидается позже. До этого момента не
  расширять и не финализировать список полей/схему хранения профиля. Частично закрыто 17 июля прямым
  решением пользователя: добавлено поле `height` (тот же паттерн, что `weight`), а `name` как отдельное
  извлекаемое поле не заводится — вместо этого имя берётся из Telegram-nickname (`InterviewProfile.displayName`,
  не участвует в `PROFILE_FIELD_CATALOG`/`applyInterviewUpdate`). Общая пометка "черновой список" для каталога
  в целом остаётся.
