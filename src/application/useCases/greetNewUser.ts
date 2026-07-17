import { startInterviewSession, type InterviewSession } from '../../domain/interviewSession.js';
import { appendCategoryProgress, createEmptyProfile, type InterviewProfile } from '../../domain/interviewProfile.js';
import type { InterviewProfileRepository } from '../ports/interviewProfileRepository.js';

// Отправляется с parseMode: 'HTML' (см. bot.command('start', ...) в
// telegramHandlers.ts) — displayName приходит из Telegram first_name/username,
// который пользователь полностью контролирует, поэтому экранируем перед
// подстановкой, иначе "<"/"&" в нике сломали бы разбор Telegram-разметки.
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * SPEC: buildGreeting
 * Назначение: приветствие на /start — разное для нового и возвращающегося
 *   пользователя (см. InterviewSessionStatus). Возвращает Telegram HTML-разметку
 *   (<b>...</b>) — вызывающий код обязан отправлять с parseMode: 'HTML'.
 * Входы/Выход: session (not_started vs in_progress/awaiting_confirmation) +
 *   профиль (может отсутствовать) → текст приветствия
 * Разрешённые side effects: нет (чистая функция)
 */
export function buildGreeting(session: InterviewSession, profile: InterviewProfile | null): string {
  const displayName = profile?.displayName ? escapeHtml(profile.displayName) : undefined;

  if (session.status === 'not_started') {
    const namePrefix = displayName ? `Hi ${displayName}! ` : 'Hi! ';
    return (
      `${namePrefix}I'm Nila — I'll ask you a few things about what's going on so I can give you ` +
      "recommendations that actually fit you, not generic advice.\n\n" +
      "We'll go through it in <b>a few short, focused blocks</b> rather than a long list of questions. " +
      'Ready to get started?\n\n' +
      '⸻\n\n' +
      '🎤 <i>Simply reply with a voice message — no need to type.</i>'
    );
  }

  const nameSuffix = displayName ? `, ${displayName}` : '';
  const greeting = `Welcome back${nameSuffix}! Let's pick up where we left off.`;
  return profile ? appendCategoryProgress(greeting, profile) : greeting;
}

// Обновляет displayName только когда он реально изменился — тот же объект
// возвращается без изменений, если сохранять нечего (см. prepareGreeting).
function withDisplayName(profile: InterviewProfile, displayName: string | undefined): InterviewProfile {
  if (displayName === undefined || profile.displayName === displayName) return profile;
  return { ...profile, displayName };
}

/**
 * SPEC: prepareGreeting
 * Назначение: собрать приветствие на /start — загрузить/создать профиль,
 *   зафиксировать Telegram-nickname как displayName, вычислить статус сессии
 *   по факту существования профиля. Вынесено из transport (CLAUDE.md §1:
 *   транспорт — только parse → use case → format reply, без прямой работы с
 *   репозиторием).
 * Входы/Выход: userId + displayName (может отсутствовать) → готовый текст приветствия
 * Разрешённые side effects: InterviewProfileRepository.load/save (только при
 *   создании нового профиля или изменении displayName)
 */
export async function prepareGreeting(
  userId: string,
  displayName: string | undefined,
  deps: { interviewProfileRepository: InterviewProfileRepository },
): Promise<string> {
  const existingProfile = await deps.interviewProfileRepository.load(userId);
  const profile = existingProfile ? withDisplayName(existingProfile, displayName) : createEmptyProfile(userId, displayName);
  if (profile !== existingProfile) {
    await deps.interviewProfileRepository.save(profile);
  }

  const session = startInterviewSession(userId, existingProfile !== null);
  return buildGreeting(session, profile);
}
