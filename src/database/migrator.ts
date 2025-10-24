import { promises as fs } from 'fs';
import path from 'path';
import { Kysely, Migrator, FileMigrationProvider, sql } from 'kysely';
import { getDatabase } from './connection';
import type { DB } from './generated-types';
import { logger } from '../utils/logger';

function createMigrator(db: Kysely<DB>) {
    return new Migrator({
        db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.join(__dirname, 'migrations'),
        }),
    });
}

export async function runMigrations(
    direction: 'latest' | 'up' | 'down' | 'reset' = 'latest'
): Promise<void> {
    const db = getDatabase();

    try {
        logger.info(`Running database migrations: ${direction}`);

        if (direction === 'reset') {
            logger.warn('Resetting public schema...');
            await sql`drop schema if exists public cascade`.execute(db);
            await sql`create schema public`.execute(db);
            // fallthrough to re-apply migrations after reset
            direction = 'latest';
        }

        const migrator = createMigrator(db);

        const { error, results } =
            direction === 'up'
                ? await migrator.migrateUp()
                : direction === 'down'
                    ? await migrator.migrateDown()
                    : await migrator.migrateToLatest();

        for (const result of results ?? []) {
            const status = result.status === 'Success' ? 'applied' : result.status.toLowerCase();
            logger.info(`Migration ${result.migrationName}: ${status}`);
        }

        if (error) {
            logger.error('Migration failed', { error });
            process.exitCode = 1;
        } else {
            logger.info('Migrations completed successfully');
        }
    } catch (err) {
        logger.error('Unexpected error during migration', { error: err });
        process.exitCode = 1;
    } finally {
        await db.destroy();
    }
}

// CLI runner: ts-node src/database/migrator.ts [latest|up|down|reset]
if (require.main === module) {
    const arg = process.argv[2] as 'latest' | 'up' | 'down' | 'reset' | undefined;
    runMigrations(arg ?? 'latest').catch((err) => {
        logger.error('Migration script failed', { error: err });
        process.exit(1);
    });
}
