import { Kysely } from 'kysely';
import fs from 'fs';
import path from 'path';
import { getDatabase } from './connection';
import type { DB } from './generated-types';
import { logger } from '../utils/logger';
import { createParticipantKey as normalizeParticipants } from '../utils/normalizer';

/**
 * Seeds the database with sample conversations and messages for testing.
 * - Uses fixed IDs for predictable test results
 * - Cleans seed data before each run
 * - Only writes to .env in dev/test environments
 */
export async function seed(): Promise<{
    conversations: { sms: string; email: string };
    messages: { sms: string; email: string };
}> {
    const db: Kysely<DB> = getDatabase();

    try {
        logger.info('Starting database seed...');
        const now = new Date();

        // Clear existing data
        await db.deleteFrom('messages').execute();
        await db.deleteFrom('conversations').execute();

        // Insert test conversations
        const smsParticipants = normalizeParticipants('+12155550123', '+14155559876');
        const emailParticipants = normalizeParticipants('user@usehatchapp.com', 'contact@gmail.com');

        const [conversation1, conversation2] = await Promise.all([
            db
                .insertInto('conversations')
                .values({ participants: smsParticipants })
                .returning('id')
                .executeTakeFirstOrThrow(),

            db
                .insertInto('conversations')
                .values({ participants: emailParticipants })
                .returning('id')
                .executeTakeFirstOrThrow(),
        ]);

        logger.info('Seeded conversations', {
            smsConversationId: conversation1.id,
            emailConversationId: conversation2.id,
        });

        // Insert test messages
        const message1 = await db
            .insertInto('messages')
            .values({
                conversation_id: conversation1.id,
                provider_type: 'sms',
                message_type: 'sms',
                provider_message_id: 'seed-sms-001',
                direction: 'outbound',
                from: '+12155550123',
                to: '+14155559876',
                body: 'Hello! This is a seeded SMS message for testing.',
                attachments: null,
                status: 'sent',
                timestamp: now,
            })
            .onConflict((oc) =>
                oc.columns(['provider_type', 'provider_message_id']).doNothing()
            )
            .returning('id')
            .executeTakeFirstOrThrow();

        const message2 = await db
            .insertInto('messages')
            .values({
                conversation_id: conversation2.id,
                provider_type: 'email',
                message_type: 'email',
                provider_message_id: 'seed-email-001',
                direction: 'outbound',
                from: 'user@usehatchapp.com',
                to: 'contact@gmail.com',
                body: '<html><body><p>Hello! This is a seeded email message for testing.</p></body></html>',
                attachments: JSON.stringify(['https://example.com/test-document.pdf']),
                status: 'sent',
                timestamp: now,
            })
            .onConflict((oc) =>
                oc.columns(['provider_type', 'provider_message_id']).doNothing()
            )
            .returning('id')
            .executeTakeFirstOrThrow();

        logger.info('Seeded messages', {
            smsMessageId: message1.id,
            emailMessageId: message2.id,
        });

        // Update .env (only in dev/test)
        const envEligible = ['development', 'test'].includes(process.env.NODE_ENV ?? '');

        if (envEligible) {
            const envPath = path.resolve(process.cwd(), '.env');
            const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

            const replacements: Record<string, string> = {
                CONVERSATION_SMS_ID: `CONVERSATION_SMS_ID=${conversation1.id}`,
                CONVERSATION_EMAIL_ID: `CONVERSATION_EMAIL_ID=${conversation2.id}`,
                MESSAGE_SMS_ID: `MESSAGE_SMS_ID=${message1.id}`,
                MESSAGE_EMAIL_ID: `MESSAGE_EMAIL_ID=${message2.id}`,
            };

            const targetKeys = new Set(Object.keys(replacements));
            const lines = envContent.length ? envContent.split(/\r?\n/) : [];
            const seen = new Set<string>();
            const out: string[] = [];

            for (const line of lines) {
                const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
                if (match && targetKeys.has(match[1])) {
                    out.push(replacements[match[1]]);
                    seen.add(match[1]);
                } else {
                    out.push(line);
                }
            }

            for (const key of targetKeys) {
                if (!seen.has(key)) out.push(replacements[key]);
            }

            fs.writeFileSync(envPath, out.join('\n').replace(/\n*$/, '\n'), 'utf-8');
            logger.info('Wrote seeded IDs to .env', { envPath });
        } else {
            logger.info('Skipping .env update — NODE_ENV is not development or test');
        }

        logger.info('Database seeding completed successfully');

        return {
            conversations: { sms: conversation1.id, email: conversation2.id },
            messages: { sms: message1.id, email: message2.id },
        };
    } catch (error) {
        logger.error('Database seeding failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}

// Allow CLI execution
if (require.main === module) {
    seed()
        .then(() => {
            logger.info('Seed script completed');
            process.exit(0);
        })
        .catch((err) => {
            logger.error('Seed script failed', { error: err });
            process.exit(1);
        });
}
