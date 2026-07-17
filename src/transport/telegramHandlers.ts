import type { Bot, Context } from 'grammy';
import type { MessagingPort, QuickReply } from '../application/ports/messagingPort.js';
import type { VoiceDownloadPort } from '../application/ports/voiceDownloadPort.js';
import type { SpeechToTextPort } from '../application/ports/speechToTextPort.js';
import type { ToneAnalysisPort } from '../application/ports/toneAnalysisPort.js';
import type { TurnRepository } from '../application/ports/turnRepository.js';
import type { InterviewEnginePort } from '../application/ports/interviewEnginePort.js';
import type { InterviewProfileRepository } from '../application/ports/interviewProfileRepository.js';
import type { CheckpointReflectionPort } from '../application/ports/checkpointReflectionPort.js';
import type { AnalyticsEventPort } from '../application/ports/analyticsEventPort.js';
import type { PendingFeedbackRepository } from '../application/ports/pendingFeedbackRepository.js';
import type { SessionPort } from '../application/ports/sessionPort.js';
import type { InterviewProfile } from '../domain/interviewProfile.js';
import type { QuickRepliesKind } from '../domain/interviewReply.js';
import { prepareGreeting } from '../application/useCases/greetNewUser.js';
import { advanceInterview, type AdvanceInterviewResult } from '../application/useCases/advanceInterview.js';
import { submitExperienceRating, type ExperienceRatingChoice } from '../application/useCases/collectInterviewFeedback.js';

export interface TelegramHandlerDependencies {
  messaging: MessagingPort;
  voiceDownload: VoiceDownloadPort;
  speechToText: SpeechToTextPort;
  toneAnalysis: ToneAnalysisPort;
  turnRepository: TurnRepository;
  interviewEngine: InterviewEnginePort;
  interviewProfileRepository: InterviewProfileRepository;
  checkpointReflection: CheckpointReflectionPort;
  analyticsEvent: AnalyticsEventPort;
  pendingFeedback: PendingFeedbackRepository;
  session: SessionPort;
  allowedChatIds: ReadonlySet<string>;
}

const EXPERIENCE_RATING_CALLBACK = /^xr:(up|down)$/;
const ALLOWLIST_DENIED_MESSAGE = 'This bot is currently invite-only.';

/**
 * SPEC: isChatAllowed
 * Назначение: инвайт-only гейт перед dogfood — пустой allowlist = без
 *   ограничений (текущий dev-режим), непустой = пропускает только
 *   перечисленные chat.id.
 * Входы/Выход: chatId + allowlist → boolean
 * Разрешённые side effects: нет (чистая функция)
 */
export function isChatAllowed(chatId: string, allowedChatIds: ReadonlySet<string>): boolean {
  return allowedChatIds.size === 0 || allowedChatIds.has(chatId);
}

// Только ключи и статусы (known/missing/deferred) — без values и evidence-quote,
// чтобы отладочная команда не выводила сырой текст пользователя (CLAUDE.md §5).
function formatCompletenessSummary(profile: InterviewProfile): string {
  const lines = profile.fields.map((field) => `${field.key}: ${field.status}`);
  return [`Profile (phase: ${profile.currentPhase}):`, ...lines].join('\n');
}

// Порядок в массиве = порядок кнопок слева→направо в ряду (grammY InlineKeyboard):
// 👎 слева, 👍 справа (решение пользователя 16 июля).
const EXPERIENCE_RATING_OPTIONS: QuickReply[] = [
  { id: 'xr:down', label: '👎' },
  { id: 'xr:up', label: '👍' },
];

function buildQuickReplyOptions(kind: QuickRepliesKind): QuickReply[] {
  return kind === 'experience' ? EXPERIENCE_RATING_OPTIONS : [];
}

async function sendInterviewReply(chatId: string, outcome: AdvanceInterviewResult, messaging: MessagingPort): Promise<void> {
  const options = buildQuickReplyOptions(outcome.quickReplies);
  if (options.length === 0) {
    await messaging.sendText(chatId, outcome.replyText);
    return;
  }
  await messaging.sendTextWithOptions(chatId, outcome.replyText, options);
}

/**
 * SPEC: handleCallbackQuery
 * Назначение: разобрать callback_data кнопки 👍/👎 под опросом об опыте
 *   разговора (единственные инлайн-кнопки в продукте, см. docs/sprint-plan.md)
 *   и делегировать в submitExperienceRating — transport здесь только
 *   parse → use case → toast/ответ (CLAUDE.md §1).
 * Разрешённые side effects: submitExperienceRating, ctx.answerCallbackQuery,
 *   MessagingPort.sendText
 */
async function handleCallbackQuery(ctx: Context & { callbackQuery: { data: string } }, deps: TelegramHandlerDependencies): Promise<void> {
  // ctx.chat резолвится и для callback_query (через callbackQuery.message) —
  // тот же паттерн, что и в message:text/message:voice ниже, без ручного
  // разбора callbackQuery.message.chat.id.
  const userId = String(ctx.from?.id ?? ctx.chat?.id);
  const chatId = String(ctx.chat?.id ?? userId);
  const experienceMatch = ctx.callbackQuery.data.match(EXPERIENCE_RATING_CALLBACK);
  if (experienceMatch) {
    const [replyText] = await Promise.all([
      submitExperienceRating(userId, experienceMatch[1] as ExperienceRatingChoice, deps),
      ctx.answerCallbackQuery(),
    ]);
    await deps.messaging.sendText(chatId, replyText);
    return;
  }

  await ctx.answerCallbackQuery();
}

export function registerTelegramHandlers(bot: Bot, deps: TelegramHandlerDependencies): void {
  bot.use(async (ctx, next) => {
    const chatId = String(ctx.chat?.id ?? ctx.from?.id);
    if (isChatAllowed(chatId, deps.allowedChatIds)) {
      await next();
      return;
    }
    if (ctx.chat) await deps.messaging.sendText(String(ctx.chat.id), ALLOWLIST_DENIED_MESSAGE);
  });

  bot.command('start', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const displayName = ctx.from?.first_name || ctx.from?.username;
    const greeting = await prepareGreeting(userId, displayName, deps);
    await deps.analyticsEvent.record('interview_started', userId, {});
    const sessionId = await deps.session.openNewSession(userId);
    await deps.session.recordBotMessage(sessionId, userId, greeting);
    await deps.messaging.sendText(String(ctx.chat.id), greeting, { parseMode: 'HTML' });
  });

  bot.command('profile', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const profile = await deps.interviewProfileRepository.load(userId);
    const summary = profile ? formatCompletenessSummary(profile) : "Profile is empty yet — start the interview first.";
    await deps.messaging.sendText(String(ctx.chat.id), summary);
  });

  bot.on('message:text', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const outcome = await advanceInterview(userId, ctx.message.text, 'text', deps);
    await sendInterviewReply(String(ctx.chat.id), outcome, deps.messaging);
  });

  bot.on('message:voice', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const audio = await deps.voiceDownload.download(ctx.message.voice.file_id);
    const text = await deps.speechToText.transcribe(audio.buffer, audio.mimeType, {
      userId,
      audioDurationSec: ctx.message.voice.duration,
    });
    const outcome = await advanceInterview(userId, text, 'voice', deps);
    await sendInterviewReply(String(ctx.chat.id), outcome, deps.messaging);
  });

  bot.on('callback_query:data', (ctx) => handleCallbackQuery(ctx, deps));
}
