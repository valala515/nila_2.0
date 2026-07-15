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
import { createAnalyticsEventRepository } from './infrastructure/sqlite/analyticsEventRepository.js';
import { createPendingFeedbackRepository } from './infrastructure/sqlite/pendingFeedbackRepository.js';
import { createAnalyticsRepository } from './infrastructure/sqlite/analyticsRepository.js';
import { createUserResetRepository } from './infrastructure/sqlite/userResetRepository.js';
import { createSessionRepository } from './infrastructure/sqlite/sessionRepository.js';
import { createConversationsRepository } from './infrastructure/sqlite/conversationsRepository.js';
import { registerTelegramHandlers } from './transport/telegramHandlers.js';
import { createDashboardApi } from './transport/dashboardApi.js';

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
const analyticsEvent = createAnalyticsEventRepository(db);
const interviewProfileRepository = createInterviewProfileRepository(db);
const pendingFeedback = createPendingFeedbackRepository(db);
const session = createSessionRepository(db);

registerTelegramHandlers(bot, {
  messaging: createMessagingPort(bot),
  voiceDownload: createVoiceDownloadPort(bot),
  speechToText: createSpeechToText(openAiClient, analyticsEvent),
  toneAnalysis: createToneAnalyzer(openAiClient),
  turnRepository: createTurnRepository(db),
  interviewEngine: createInterviewEngine(openAiClient, analyticsEvent),
  interviewProfileRepository,
  checkpointReflection: createCheckpointReflection(openAiClient, analyticsEvent),
  analyticsEvent,
  pendingFeedback,
  session,
});

bot.catch((err) => {
  console.error('Unhandled bot error:', err.message);
  Sentry.captureException(err.error);
});

const dashboardApi = createDashboardApi({
  analyticsQuery: createAnalyticsRepository(db),
  conversationsQuery: createConversationsRepository(db),
  userHistory: {
    interviewProfileRepository,
    pendingFeedback,
    session,
    userReset: createUserResetRepository(db),
    analyticsEvent,
  },
  token: env.DASHBOARD_TOKEN,
  staticDir: env.DASHBOARD_STATIC_DIR,
});
dashboardApi.listen(env.DASHBOARD_PORT, () => {
  console.log(`Dashboard API listening on port ${env.DASHBOARD_PORT}`);
});

await bot.start();
