import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely'; // Correct import from 'kysely'
import { Pool } from 'pg';
import type { DB } from './generated-types';
import config from '../utils/config';
import { logger } from '../utils/logger';

import dotenv from 'dotenv';
dotenv.config();

let db: Kysely<DB> | null = null;

/**
 * Creates and returns a Kysely database instance with connection pooling
 */
export function createDatabase(): Kysely<DB> {
    const pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
        min: config.database.poolMin,
        max: config.database.poolMax,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
        logger.error('Unexpected database pool error', { error: err });
    });

    const dialect = new PostgresDialect({
        pool,
    });

    return new Kysely<DB>({
        dialect,
        plugins: [new CamelCasePlugin()], // Add plugin here for consistency
        log(event) {
            if (event.level === 'query') {
                logger.debug('Database query', {
                    sql: event.query.sql,
                    parameters: event.query.parameters,
                    duration: event.queryDurationMillis,
                });
            } else if (event.level === 'error') {
                logger.error('Database query error', {
                    error: event.error,
                    sql: event.query.sql,
                });
            }
        },
    });
}

/**
 * Gets the database instance (creates if not exists)
 */
export function getDatabase(): Kysely<DB> {
    if (!db) {
        db = new Kysely<DB>({
            dialect: new PostgresDialect({
                pool: new Pool({
                    host: process.env.DB_HOST || 'localhost',
                    port: Number(process.env.DB_PORT) || 5432,
                    user: process.env.DB_USER || 'messaging_user',
                    password: process.env.DB_PASSWORD || 'messaging_password',
                    database: process.env.DB_NAME || 'messaging_service',
                }),
            }),
            plugins: [new CamelCasePlugin()],
        });
    }

    return db;
}

/**
 * Closes the database connection
 */
export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.destroy();
        db = null;
        logger.info('Database connection closed');
    }
}

/**
 * Tests database connectivity
 */
export async function testDatabaseConnection(): Promise<boolean> {
    try {
        const database = getDatabase();
        await database.selectFrom('conversations').select('id').limit(1).execute();
        return true;
    } catch (error) {
        logger.error('Database connection test failed', { error });
        return false;
    }
}

/**
 * Get database connection health and latency
 */
export async function getDatabaseHealth(): Promise<{ connected: boolean; latencyMs?: number }> {
    try {
        const database = getDatabase();
        const startTime = Date.now();
        await database.selectFrom('conversations').select('id').limit(1).execute();
        const latency = Date.now() - startTime;
        return { connected: true, latencyMs: latency };
    } catch (error) {
        logger.error('Database health check failed', { error });
        return { connected: false };
    }
}

export default getDatabase;