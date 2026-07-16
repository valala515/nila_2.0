// Fetches the New Mind Start course catalog and stores it locally in SQLite.
// Not part of `pnpm test`/CI on purpose — makes real calls to the NMS API and
// its result depends on live catalog content (mirrors the ai_agent_chat
// sync-as-a-script convention, scripts/syncCourses.js there).
// Run with: pnpm run courses:sync
import { createDatabase } from '../src/infrastructure/sqlite/db.js';
import { createCourseRepository } from '../src/infrastructure/sqlite/courseRepository.js';
import { createCourseCatalogClient } from '../src/infrastructure/newmindstart/courseCatalogClient.js';
import { syncCourseCatalog } from '../src/application/useCases/syncCourseCatalog.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required — add it to .env before running this script.`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const baseUrl = process.env.NMS_API_URL || 'https://newmindstart.com';
  const botKey = process.env.NILA_SERVER_TOKEN || requireEnv('NMS_BOT_KEY');
  const databasePath = process.env.DATABASE_PATH || './data/nila.sqlite';

  const catalogClient = createCourseCatalogClient({ baseUrl, botKey });
  const db = createDatabase(databasePath);
  const repository = createCourseRepository(db);

  console.log('Syncing NMS course catalog...');
  const result = await syncCourseCatalog(catalogClient, repository);
  console.log(`Synced ${result.total} courses at ${result.syncedAt}.`);

  db.close();
}

main().catch((error: unknown) => {
  console.error('Course sync failed:', error);
  process.exit(1);
});
