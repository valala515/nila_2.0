import type { Bot } from 'grammy';
import type { MessagingPort } from '../application/ports/messagingPort.js';
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
import { startInterviewSession } from '../domain/interviewSession.js';
import { buildGreeting } from '../application/useCases/greetNewUser.js';
import { advanceInterview } from '../application/useCases/advanceInterview.js';
import { collectInterviewFeedback } from '../application/useCases/collectInterviewFeedback.js';

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
}

// Только ключи и статусы (known/missing/deferred) — без values и evidence-quote,
// чтобы отладочная команда не выводила сырой текст пользователя (CLAUDE.md §5).
function formatCompletenessSummary(profile: InterviewProfile): string {
  const lines = profile.fields.map((field) => `${field.key}: ${field.status}`);
  return [`Profile (phase: ${profile.currentPhase}):`, ...lines].join('\n');
}

export function registerTelegramHandlers(bot: Bot, deps: TelegramHandlerDependencies): void {
  bot.command('start', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const interviewSession = startInterviewSession(userId);
    const greeting = buildGreeting(interviewSession);
    await deps.analyticsEvent.record('interview_started', userId, {});
    const sessionId = await deps.session.openNewSession(userId);
    await deps.session.recordBotMessage(sessionId, userId, greeting);
    await deps.messaging.sendText(String(ctx.chat.id), greeting);
  });

  bot.command('profile', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const profile = await deps.interviewProfileRepository.load(userId);
    const summary = profile ? formatCompletenessSummary(profile) : "Profile is empty yet — start the interview first.";
    await deps.messaging.sendText(String(ctx.chat.id), summary);
  });

  bot.on('message:text', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const pendingFeedbackKind = await deps.pendingFeedback.getPending(userId);
    const replyText = pendingFeedbackKind
      ? await collectInterviewFeedback(userId, ctx.message.text, 'text', pendingFeedbackKind, deps)
      : (await advanceInterview(userId, ctx.message.text, 'text', deps)).replyText;
    await deps.messaging.sendText(String(ctx.chat.id), replyText);
  });

  bot.on('message:voice', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const audio = await deps.voiceDownload.download(ctx.message.voice.file_id);
    const text = await deps.speechToText.transcribe(audio.buffer, audio.mimeType, {
      userId,
      audioDurationSec: ctx.message.voice.duration,
    });
    const pendingFeedbackKind = await deps.pendingFeedback.getPending(userId);
    const replyText = pendingFeedbackKind
      ? await collectInterviewFeedback(userId, text, 'voice', pendingFeedbackKind, deps)
      : (await advanceInterview(userId, text, 'voice', deps)).replyText;
    await deps.messaging.sendText(String(ctx.chat.id), replyText);
  });
}
