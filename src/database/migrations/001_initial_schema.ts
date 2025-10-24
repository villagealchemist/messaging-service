import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Enable UUID generation extension (safe to call repeatedly)
    await sql`create extension if not exists pgcrypto`.execute(db);

    // ---------------------------
    // Create conversations table
    // ---------------------------
    await db.schema
        .createTable('conversations')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('participants', 'text', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('last_message_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .execute();

    await db.schema
        .createIndex('idx_conversations_last_message_at')
        .on('conversations')
        .column('last_message_at')
        .execute();

    // ------------------------
    // Create messages table
    // ------------------------
    await db.schema
        .createTable('messages')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('conversation_id', 'uuid', (col) =>
            col.notNull().references('conversations.id').onDelete('cascade'),
        )
        .addColumn('provider_type', 'text', (col) =>
            col.notNull().check(sql`provider_type in ('sms','email')`),
        )
        .addColumn('message_type', 'text', (col) =>
            col.notNull().check(sql`message_type in ('sms','mms','email')`),
        )
        .addColumn('provider_message_id', 'text') // nullable
        .addColumn('direction', 'text', (col) =>
            col.notNull().check(sql`direction in ('inbound','outbound')`),
        )
        .addColumn('from', 'text', (col) => col.notNull())
        .addColumn('to', 'text', (col) => col.notNull())
        .addColumn('body', 'text', (col) => col.notNull())
        .addColumn('attachments', 'text') // JSON string or null
        .addColumn('status', 'text', (col) =>
            col
                .notNull()
                .defaultTo('pending')
                .check(sql`status in ('pending','sent','delivered','failed')`),
        )
        .addColumn('timestamp', 'timestamptz', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('retry_count', 'integer', (col) =>
            col.notNull().defaultTo(0),
        )
        .addColumn('error_message', 'text')
        .addUniqueConstraint(
            'uq_messages_provider_type_id',
            ['provider_type', 'provider_message_id'],
        ) // ✅ full unique constraint for ON CONFLICT support
        .execute();

    await db.schema
        .createIndex('idx_messages_conversation_id_timestamp')
        .on('messages')
        .columns(['conversation_id', 'timestamp'])
        .execute();
}
