import * as Sentry from '@sentry/node';
import { loadEnv } from './config/env.js';
import { BUILD_VERSION } from './config/version.js';
import { initErrorTracking } from './infrastructure/monitoring/errorTracker.js';
import { createTelegramBot, createMessagingPort, createVoiceDownloadPort } from './infrastructure/telegram/bot.js';
import { createOpenAiClient } from './infrastructure/openai/client.js';
import { createSpeechToText } from './infrastructure/openai/speechToText.js';
import { createToneAnalyzer } from './infrastructure/openai/toneAnalyzer.js';
import { createInterviewEngine } from './infrastructure/openai/interviewEngine.js';
import { createCheckpointReflection } from './infrastructure/openai/checkpointReflection.js';
import { createDatabase } from './infrastructure/sqlite/db.js';
import { createTurnRepository } from './infrastructure/sqlite/turnRepository.js';
import { createInterviewProfileRepository } from './infrastructure/sqlite/interviewProfileRepository.js';
import { registerTelegramHandlers } from './transport/telegramHandlers.js';

const env = loadEnv();
initErrorTracking(env);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  Sentry.captureException(reason);
});

console.log(`Nila bot starting — build ${BUILD_VERSION}`);

const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN);
const openAiClient = createOpenAiClient(env.OPENAI_API_KEY);
const db = createDatabase(env.DATABASE_PATH);

registerTelegramHandlers(bot, {
  messaging: createMessagingPort(bot),
  voiceDownload: createVoiceDownloadPort(bot),
  speechToText: createSpeechToText(openAiClient),
  toneAnalysis: createToneAnalyzer(openAiClient),
  turnRepository: createTurnRepository(db),
  interviewEngine: createInterviewEngine(openAiClient),
  interviewProfileRepository: createInterviewProfileRepository(db),
  checkpointReflection: createCheckpointReflection(openAiClient),
});

bot.catch((err) => {
  console.error('Unhandled bot error:', err.message);
  Sentry.captureException(err.error);
});

await bot.start();
