/**
 * Database query helpers and utilities.
 * Reusable query fragments for complex aggregations.
 */

import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { getDatabase } from './connection';

/**
 * Aggregates messages for a conversation using jsonArrayFrom.
 * Returns a Kysely expression that can be used in SELECT queries.
 *
 * @param options - Configuration options
 * @param options.alias - Alias for the conversations table (default: 'c')
 * @param options.limit - Maximum number of messages to include
 * @returns Kysely expression that resolves to JSON array of messages
 *
 * @example
 * ```typescript
 * const query = db
 *   .selectFrom('conversations as c')
 *   .select(['c.*', aggregateMessagesForConversation({ limit: 50 }).as('messages')])
 * ```
 */
export function aggregateMessagesForConversation(options?: {
    alias?: string;
    limit?: number;
}) {
    const db = getDatabase();
    const alias = options?.alias ?? 'c';

    let subquery = db
        .selectFrom('messages as m')
        .selectAll('m')
        .whereRef('m.conversation_id', '=', sql.ref(`${alias}.id`))
        .where('m.id', 'is not', null)
        .orderBy('m.timestamp', 'asc');

    if (options?.limit) {
        subquery = subquery.limit(options.limit);
    }

    return db.fn.coalesce(jsonArrayFrom(subquery), sql`'[]'::json`);
}
