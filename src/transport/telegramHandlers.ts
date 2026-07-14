import type { Bot } from 'grammy';
import type { MessagingPort } from '../application/ports/messagingPort.js';
import type { VoiceDownloadPort } from '../application/ports/voiceDownloadPort.js';
import type { SpeechToTextPort } from '../application/ports/speechToTextPort.js';
import type { ToneAnalysisPort } from '../application/ports/toneAnalysisPort.js';
import type { TurnRepository } from '../application/ports/turnRepository.js';
import { startInterviewSession } from '../domain/interviewSession.js';
import { buildGreeting } from '../application/useCases/greetNewUser.js';
import { buildEchoReply } from '../application/useCases/echoUserMessage.js';
import { processUserUtterance } from '../application/useCases/processUserUtterance.js';

export interface TelegramHandlerDependencies {
  messaging: MessagingPort;
  voiceDownload: VoiceDownloadPort;
  speechToText: SpeechToTextPort;
  toneAnalysis: ToneAnalysisPort;
  turnRepository: TurnRepository;
}

export function registerTelegramHandlers(bot: Bot, deps: TelegramHandlerDependencies): void {
  bot.command('start', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const session = startInterviewSession(userId);
    await deps.messaging.sendText(String(ctx.chat.id), buildGreeting(session));
  });

  bot.on('message:text', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const text = ctx.message.text;
    const turn = await processUserUtterance(userId, text, 'text', deps);
    await deps.messaging.sendText(String(ctx.chat.id), `${buildEchoReply(text)} (tone: ${turn.tone})`);
  });

  bot.on('message:voice', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat.id);
    const audio = await deps.voiceDownload.download(ctx.message.voice.file_id);
    const text = await deps.speechToText.transcribe(audio.buffer, audio.mimeType);
    const turn = await processUserUtterance(userId, text, 'voice', deps);
    await deps.messaging.sendText(String(ctx.chat.id), `Transcribed: "${text}" (tone: ${turn.tone})`);
  });
}
