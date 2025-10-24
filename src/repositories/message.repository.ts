import { Kysely, Selectable } from 'kysely';
import { Logger } from 'winston';
import { getDatabase } from '../database/connection';
import type { DB, Messages } from '../database/generated-types';
import { UUID, MessageStatus, ProviderType, CreateMessage } from '../models';

/**
 * Repository for message database operations.
 * Stateless, type-safe CRUD operations with per-request contextual logging.
 * Pure I/O - no error transformation, no validation, no business logic.
 */
export class MessageRepository {
    private get db(): Kysely<DB> {
        return getDatabase();
    }

    constructor(private readonly logger: Logger) {}

    /**
     * Creates a new message record in the database.
     *
     * @param params - Message creation parameters including conversation ID, provider details, and content
     * @returns The created message with all generated fields (id, createdAt, etc.)
     */
    async create(params: CreateMessage): Promise<Selectable<Messages>> {
        const start = Date.now();

        this.logger.debug('Creating message', {
            conversationId: params.conversationId,
            providerType: params.providerType,
            direction: params.direction,
        });

        const message = await this.db
            .insertInto('messages')
            .values({
                conversation_id: params.conversationId,
                provider_type: params.providerType,
                message_type: params.messageType,
                provider_message_id: params.providerMessageId ?? null,
                direction: params.direction,
                from: params.from,
                to: params.to,
                body: params.body,
                attachments: params.attachments
                    ? JSON.stringify(params.attachments)
                    : null,
                status: params.status,
                timestamp:
                    params.timestamp instanceof Date
                        ? params.timestamp
                        : new Date(params.timestamp),
                retry_count: 0,
                error_message: null,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        this.logger.info('Message created', {
            messageId: message.id,
            conversationId: message.conversation_id,
            durationMs: Date.now() - start,
        });

        return message;
    }

    /**
     * Finds a message by its provider-specific message ID.
     *
     * @param providerType - The messaging provider (sms or email)
     * @param providerMessageId - The unique ID from the provider
     * @returns The message if found, undefined otherwise
     */
    async findByProviderMessageId(
        providerType: ProviderType,
        providerMessageId: string
    ): Promise<Selectable<Messages> | undefined> {
        const start = Date.now();

        this.logger.debug('Finding message by provider ID', {
            providerType,
            providerMessageId,
        });

        const message = await this.db
            .selectFrom('messages')
            .selectAll()
            .where('provider_type', '=', providerType)
            .where('provider_message_id', '=', providerMessageId)
            .executeTakeFirst();

        this.logger.debug('Find by providerMessageId complete', {
            providerType,
            providerMessageId,
            found: !!message,
            durationMs: Date.now() - start,
        });

        return message;
    }

    /**
     * Finds a message by its unique ID.
     *
     * @param id - The message UUID
     * @returns The message if found, undefined otherwise
     */
    async findById(id: UUID): Promise<Selectable<Messages> | undefined> {
        const start = Date.now();

        this.logger.debug('Finding message by ID', { id });

        const message = await this.db
            .selectFrom('messages')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        this.logger.debug('Find by ID complete', {
            id,
            found: !!message,
            durationMs: Date.now() - start,
        });

        return message;
    }

    /**
     * Retrieves all messages for a given conversation, ordered chronologically.
     *
     * @param conversationId - The conversation UUID
     * @param limit - Maximum number of messages to return (default: 100)
     * @returns Array of messages ordered by timestamp and ID (ascending)
     */
    async findByConversationId(
        conversationId: UUID,
        limit = 100
    ): Promise<Selectable<Messages>[]> {
        const start = Date.now();

        this.logger.debug('Finding messages for conversation', {
            conversationId,
            limit,
        });

        const messages = await this.db
            .selectFrom('messages')
            .selectAll()
            .where('conversation_id', '=', conversationId)
            .orderBy('timestamp', 'asc')
            .orderBy('id', 'asc')
            .limit(limit)
            .execute();

        this.logger.debug('Messages fetched for conversation', {
            conversationId,
            count: messages.length,
            durationMs: Date.now() - start,
        });

        return messages;
    }

    /**
     * Retrieves the most recent message for a conversation.
     *
     * @param conversationId - The conversation UUID
     * @returns The latest message if exists, undefined otherwise
     */
    async findLatestByConversationId(
        conversationId: UUID
    ): Promise<Selectable<Messages> | undefined> {
        const start = Date.now();

        this.logger.debug('Finding latest message for conversation', {
            conversationId,
        });

        const message = await this.db
            .selectFrom('messages')
            .selectAll()
            .where('conversation_id', '=', conversationId)
            .orderBy('timestamp', 'desc')
            .orderBy('id', 'desc')
            .limit(1)
            .executeTakeFirst();

        this.logger.debug('Fetched latest message', {
            conversationId,
            found: !!message,
            durationMs: Date.now() - start,
        });

        return message;
    }

    /**
     * Updates the status of a message and optionally sets an error message.
     *
     * @param id - The message UUID
     * @param status - The new message status
     * @param errorMessage - Optional error message for failed statuses
     * @returns The updated message record
     */
    async updateStatus(
        id: UUID,
        status: MessageStatus,
        errorMessage?: string
    ): Promise<Selectable<Messages>> {
        const start = Date.now();

        this.logger.debug('Updating message status', {
            id,
            status,
            errorMessage,
        });

        const message = await this.db
            .updateTable('messages')
            .set({
                status,
                error_message: errorMessage ?? null,
            })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirstOrThrow();

        this.logger.info('Message status updated', {
            id,
            status,
            durationMs: Date.now() - start,
        });

        return message;
    }

    /**
     * Increments the retry counter for a message by 1.
     *
     * @param id - The message UUID
     */
    async incrementRetryCount(id: UUID): Promise<void> {
        const start = Date.now();

        this.logger.debug('Incrementing retry count', { id });

        await this.db
            .updateTable('messages')
            .set((eb) => ({
                retry_count: eb('retry_count', '+', 1),
            }))
            .where('id', '=', id)
            .execute();

        this.logger.debug('Incremented retryCount', {
            id,
            durationMs: Date.now() - start,
        });
    }

    /**
     * Deletes a message by ID.
     *
     * @param id - The message UUID
     * @returns True if message was deleted, false if not found
     */
    async delete(id: UUID): Promise<boolean> {
        const start = Date.now();

        this.logger.debug('Deleting message', { id });

        const result = await this.db
            .deleteFrom('messages')
            .where('id', '=', id)
            .executeTakeFirst();

        const deleted = result.numDeletedRows > 0n;

        this.logger.info(deleted ? 'Deleted message' : 'Message not found', {
            id,
            durationMs: Date.now() - start,
        });

        return deleted;
    }

    /**
     * Counts the total number of messages in a conversation.
     *
     * @param conversationId - The conversation UUID
     * @returns The count of messages
     */
    async countByConversationId(conversationId: UUID): Promise<number> {
        const start = Date.now();

        this.logger.debug('Counting messages for conversation', {
            conversationId,
        });

        const result = await this.db
            .selectFrom('messages')
            .select((eb) => eb.fn.countAll<string>().as('count'))
            .where('conversation_id', '=', conversationId)
            .executeTakeFirstOrThrow();

        const count = Number(result.count);

        this.logger.debug('Counted messages', {
            conversationId,
            count,
            durationMs: Date.now() - start,
        });

        return count;
    }
}
