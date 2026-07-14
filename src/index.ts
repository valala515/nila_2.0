import { loadEnv } from './config/env.js';
import { BUILD_VERSION } from './config/version.js';
import { createTelegramBot, createMessagingPort, createVoiceDownloadPort } from './infrastructure/telegram/bot.js';
import { createOpenAiClient } from './infrastructure/openai/client.js';
import { createSpeechToText } from './infrastructure/openai/speechToText.js';
import { createToneAnalyzer } from './infrastructure/openai/toneAnalyzer.js';
import { createDatabase } from './infrastructure/sqlite/db.js';
import { createTurnRepository } from './infrastructure/sqlite/turnRepository.js';
import { registerTelegramHandlers } from './transport/telegramHandlers.js';

const env = loadEnv();

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
});

bot.catch((err) => {
  console.error('Unhandled bot error:', err.message);
});

await bot.start();
