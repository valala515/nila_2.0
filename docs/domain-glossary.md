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

Соответствие со сводом (`docs/input/...`): «completeness map» свода = множество
`ProfileField.status` по всем полям; «open threads» — как в своде, без изменений.
