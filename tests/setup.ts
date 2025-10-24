import { runMigrations } from '../src/database/migrate';
import { getDatabase } from '../src/database';

// Run migrations before all tests
beforeAll(async () => {
  await runMigrations('latest');
}, 30000);

// Clean up database after all tests
afterAll(async () => {
  const db = getDatabase();
  await db.destroy();
});

// Helper to reset database between test suites
export async function resetDatabase() {
  const db = getDatabase();
  await db.deleteFrom('messages').execute();
  await db.deleteFrom('conversations').execute();
}
