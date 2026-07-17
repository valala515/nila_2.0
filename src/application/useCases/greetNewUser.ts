import { startInterviewSession, type InterviewSession } from '../../domain/interviewSession.js';
import { appendCategoryProgress, createEmptyProfile, type InterviewProfile } from '../../domain/interviewProfile.js';
import type { InterviewProfileRepository } from '../ports/interviewProfileRepository.js';

/**
 * SPEC: buildGreeting
 * Назначение: приветствие на /start — разное для нового и возвращающегося
 *   пользователя (см. InterviewSessionStatus).
 * Входы/Выход: session (not_started vs in_progress/awaiting_confirmation) +
 *   профиль (может отсутствовать) → текст приветствия
 * Разрешённые side effects: нет (чистая функция)
 */
export function buildGreeting(session: InterviewSession, profile: InterviewProfile | null): string {
  if (session.status === 'not_started') {
    const namePrefix = profile?.displayName ? `Hi ${profile.displayName}! ` : 'Hi! ';
    return (
      `${namePrefix}I'm Nila — I'll ask you a few things about what's going on so I can give you ` +
      "recommendations that actually fit you, not generic advice. We'll go through it in a few short, " +
      "focused blocks rather than a long list of questions — and you can reply by text or by voice message, " +
      'whichever is easier for you. Ready to get started?'
    );
  }

  const nameSuffix = profile?.displayName ? `, ${profile.displayName}` : '';
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
