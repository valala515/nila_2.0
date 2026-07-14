import type { Bot } from 'grammy';
import type { MessagingPort } from '../application/ports/messagingPort.js';
import type { VoiceDownloadPort } from '../application/ports/voiceDownloadPort.js';
import type { SpeechToTextPort } from '../application/ports/speechToTextPort.js';
import type { ToneAnalysisPort } from '../application/ports/toneAnalysisPort.js';
import type { TurnRepository } from '../application/ports/turnRepository.js';
import type { InterviewEnginePort } from '../application/ports/interviewEnginePort.js';
import type { InterviewProfileRepository } from '../application/ports/interviewProfileRepository.js';
import type { InterviewProfile } from '../domain/interviewProfile.js';
import { startInterviewSession } from '../domain/interviewSession.js';
import { buildGreeting } from '../application/useCases/greetNewUser.js';
import { advanceInterview } from '../application/useCases/advanceInterview.js';

export interface TelegramHandlerDependencies {
  messaging: MessagingPort;
  voiceDownload: VoiceDownloadPort;
  speechToText: SpeechToTextPort;
  toneAnalysis: ToneAnalysisPort;
  turnRepository: TurnRepository;
  interviewEngine: InterviewEnginePort;
  interviewProfileRepository: InterviewProfileRepository;
}

// Только ключи и статусы (known/missing/deferred) — без values и evidence-quote,
// чтобы отладочная команда не выводила сырой текст пользователя (CLAUDE.md §5).
function formatCompletenessSummary(profile: InterviewProfile): string {
  const lines = profile.fields.map((field) => `${field.key}: ${field.status}`);
  return ['Profile (field statuses):', ...lines].join('\n');
}

export function registerTelegramHandlers(bot: Bot, deps: TelegramHandlerDependencies): void {
  bot.command('start', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const session = startInterviewSession(userId);
    await deps.messaging.sendText(String(ctx.chat.id), buildGreeting(session));
  });

  bot.command('profile', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const profile = await deps.interviewProfileRepository.load(userId);
    const summary = profile ? formatCompletenessSummary(profile) : "Profile is empty yet — start the interview first.";
    await deps.messaging.sendText(String(ctx.chat.id), summary);
  });

  bot.on('message:text', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const { replyText } = await advanceInterview(userId, ctx.message.text, 'text', deps);
    await deps.messaging.sendText(String(ctx.chat.id), replyText);
  });

  bot.on('message:voice', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const audio = await deps.voiceDownload.download(ctx.message.voice.file_id);
    const text = await deps.speechToText.transcribe(audio.buffer, audio.mimeType);
    const { replyText } = await advanceInterview(userId, text, 'voice', deps);
    await deps.messaging.sendText(String(ctx.chat.id), replyText);
  });
}
