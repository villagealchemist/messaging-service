import { Kysely, Selectable } from 'kysely';
import { Logger } from 'winston';
import { getDatabase } from '../database/connection';
import type { DB, Conversations, Messages } from '../database/generated-types';
import { UUID } from '../models';
import { aggregateMessagesForConversation } from '../database/helpers';

/**
 * Repository for conversation database operations.
 * Stateless, type-safe CRUD operations with per-request contextual logging.
 * Pure I/O - no error transformation, no validation, no business logic.
 */
export class ConversationRepository {
    private get db(): Kysely<DB> {
        return getDatabase();
    }

    constructor(private readonly logger: Logger) {}

    /**
     * Creates a new conversation with the given participants key.
     *
     * @param participantsKey - Normalized JSON string of sorted participant identifiers
     * @returns The created conversation record
     */
    async create(participantsKey: string): Promise<Selectable<Conversations>> {
        const start = Date.now();

        this.logger.debug('Creating new conversation', { participantsKey });

        const conversation = await this.db
            .insertInto('conversations')
            .values({
                participants: participantsKey,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        this.logger.info('Created new conversation', {
            conversationId: conversation.id,
            durationMs: Date.now() - start,
        });

        return conversation;
    }

    /**
     * Finds a conversation by its normalized participants key.
     *
     * @param participantsKey - Normalized JSON string of sorted participant identifiers
     * @returns The conversation if found, undefined otherwise
     */
    async findByParticipants(participantsKey: string): Promise<Selectable<Conversations> | undefined> {
        const start = Date.now();

        this.logger.debug('Finding conversation by participants', { participantsKey });

        const conversation = await this.db
            .selectFrom('conversations')
            .selectAll()
            .where('participants', '=', participantsKey)
            .executeTakeFirst();

        this.logger.debug('Find by participants complete', {
            found: !!conversation,
            durationMs: Date.now() - start,
        });

        return conversation;
    }

    /**
     * Finds or creates a conversation for the given participants.
     * This is a convenience method for the common "upsert" pattern.
     *
     * @param participantsKey - Normalized JSON string of sorted participant identifiers
     * @returns The existing or newly created conversation record
     */
    async findOrCreate(participantsKey: string): Promise<Selectable<Conversations>> {
        const existing = await this.findByParticipants(participantsKey);

        if (existing) {
            this.logger.debug('Using existing conversation', {
                conversationId: existing.id,
                participantsKey,
            });
            return existing;
        }

        return await this.create(participantsKey);
    }

    /**
     * Finds a conversation by its unique ID.
     *
     * @param id - The conversation UUID
     * @returns The conversation if found, undefined otherwise
     */
    async findById(id: UUID): Promise<Selectable<Conversations> | undefined> {
        const start = Date.now();

        this.logger.debug('Finding conversation by ID', { id });

        const conversation = await this.db
            .selectFrom('conversations')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        this.logger.debug('Find by ID complete', {
            id,
            found: !!conversation,
            durationMs: Date.now() - start,
        });

        return conversation;
    }

    /**
     * Lists all conversations with pagination, ordered by most recent message.
     *
     * @param limit - Maximum number of conversations to return (default: 50)
     * @param offset - Number of conversations to skip for pagination (default: 0)
     * @returns Array of conversations ordered by lastMessageAt DESC
     */
    async findAll(limit: number = 50, offset: number = 0): Promise<Selectable<Conversations>[]> {
        const start = Date.now();

        this.logger.debug('Retrieving conversations', { limit, offset });

        const conversations = await this.db
            .selectFrom('conversations')
            .selectAll()
            .orderBy('last_message_at', 'desc')
            .orderBy('id', 'desc')
            .limit(limit)
            .offset(offset)
            .execute();

        this.logger.debug('Retrieved conversations', {
            count: conversations.length,
            limit,
            offset,
            durationMs: Date.now() - start,
        });

        return conversations;
    }

    /**
     * Deletes a conversation by ID. Messages are cascaded via foreign key constraint.
     *
     * @param id - The conversation UUID
     * @returns True if conversation was deleted, false if not found
     */
    async delete(id: UUID): Promise<boolean> {
        const start = Date.now();

        this.logger.debug('Deleting conversation', { id });

        const result = await this.db
            .deleteFrom('conversations')
            .where('id', '=', id)
            .executeTakeFirst();

        const deleted = result.numDeletedRows > 0n;

        this.logger.info(deleted ? 'Deleted conversation' : 'Conversation not found', {
            id,
            durationMs: Date.now() - start,
        });

        return deleted;
    }

    /**
     * Counts the total number of conversations.
     *
     * @returns The count of conversations
     */
    async count(): Promise<number> {
        const start = Date.now();

        this.logger.debug('Counting conversations');

        const result = await this.db
            .selectFrom('conversations')
            .select((eb) => eb.fn.countAll<string>().as('count'))
            .executeTakeFirstOrThrow();

        const count = Number(result.count);

        this.logger.debug('Counted conversations', {
            count,
            durationMs: Date.now() - start,
        });

        return count;
    }

    /**
     * Finds a conversation by ID with its message history aggregated in a single query.
     * Messages are ordered by timestamp ascending and default to empty array.
     *
     * @param id - The conversation UUID
     * @param messageLimit - Maximum number of messages to include (default: 100)
     * @returns The conversation with messages array, or undefined if not found
     */
    async findByIdWithMessages(
        id: UUID,
        messageLimit: number = 100
    ): Promise<(Selectable<Conversations> & { messages: Selectable<Messages>[] }) | undefined> {
        const start = Date.now();

        this.logger.debug('Finding conversation with messages by ID', { id, messageLimit });

        const conversation = await this.db
            .selectFrom('conversations as c')
            .selectAll('c')
            .select([
                aggregateMessagesForConversation({ limit: messageLimit }).as('messages'),
            ])
            .where('c.id', '=', id)
            .executeTakeFirst();

        this.logger.debug('Find by ID with messages complete', {
            id,
            found: !!conversation,
            messageCount: conversation?.messages?.length ?? 0,
            durationMs: Date.now() - start,
        });

        return conversation;
    }

    /**
     * Lists conversations with their message history aggregated in a single query.
     * Messages are ordered by timestamp ascending and default to empty array.
     *
     * @param limit - Maximum number of conversations to return (default: 50)
     * @param offset - Number of conversations to skip for pagination (default: 0)
     * @param messageLimit - Maximum number of messages per conversation (default: 100)
     * @returns Array of conversations with messages, ordered by lastMessageAt DESC
     */
    async findAllWithMessages(
        limit: number = 50,
        offset: number = 0,
        messageLimit: number = 100
    ): Promise<(Selectable<Conversations> & { messages: Selectable<Messages>[] })[]> {
        const start = Date.now();

        this.logger.debug('Retrieving conversations with messages', { limit, offset, messageLimit });

        const conversations = await this.db
            .selectFrom('conversations as c')
            .selectAll('c')
            .select([
                aggregateMessagesForConversation({ limit: messageLimit }).as('messages'),
            ])
            .orderBy('c.last_message_at', 'desc')
            .orderBy('c.id', 'desc')
            .limit(limit)
            .offset(offset)
            .execute();

        this.logger.debug('Retrieved conversations with messages', {
            count: conversations.length,
            limit,
            offset,
            durationMs: Date.now() - start,
        });

        return conversations;
    }
}
