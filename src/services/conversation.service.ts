import { Logger } from 'winston';
import { Selectable } from 'kysely';
import { ConversationRepository } from '../repositories/conversation.repository';
import { Conversations } from '../database/generated-types';
import { normalizeContact, createParticipantKey } from '../utils/normalizer';
import { toConversationResponse, toMessageResponse } from '../utils/mappers';
import { AppError, FieldError } from '../errors/appError';
import { ContactIdentifier, UUID, ConversationResponse, ConversationWithMessages } from '../models';

/**
 * Service layer for conversation business logic.
 * Performs semantic validation, normalization, and orchestrates repository calls.
 * Transforms repository errors into domain errors (AppError, ValidationError).
 */
export class ConversationService {
    private readonly conversationRepo: ConversationRepository;

    constructor(private readonly logger: Logger) {
        this.conversationRepo = new ConversationRepository(logger);
    }

    /**
     * Finds or creates a conversation between two participants.
     * Performs normalization and semantic validation.
     * Aggregates all validation errors before throwing.
     *
     * @param from - First participant contact identifier
     * @param to - Second participant contact identifier
     * @returns The existing or newly created conversation
     * @throws ValidationError if normalization or semantic validation fails
     * @throws AppError if repository operation fails
     */
    async findOrCreateConversation(
        from: ContactIdentifier,
        to: ContactIdentifier
    ): Promise<Selectable<Conversations>> {
        const start = Date.now();
        const errors: FieldError[] = [];

        this.logger.debug('Finding or creating conversation', { from, to });

        // Normalize both participants, collecting errors
        let normalizedFrom: string | undefined;
        let normalizedTo: string | undefined;

        try {
            normalizedFrom = normalizeContact(from);
        } catch (error) {
            errors.push({
                field: 'from',
                message: 'Invalid phone or email format',
                code: 'INVALID_CONTACT_FORMAT',
            });
        }

        try {
            normalizedTo = normalizeContact(to);
        } catch (error) {
            errors.push({
                field: 'to',
                message: 'Invalid phone or email format',
                code: 'INVALID_CONTACT_FORMAT',
            });
        }

        // Check for same participant after successful normalization
        if (normalizedFrom && normalizedTo && normalizedFrom === normalizedTo) {
            errors.push({
                field: 'participants',
                message: 'Conversation must be between distinct participants',
                code: 'PARTICIPANTS_IDENTICAL',
            });
        }

        // Throw aggregated validation errors if any exist
        if (errors.length > 0) {
            this.logger.warn('Conversation validation failed', {
                from,
                to,
                errors,
                durationMs: Date.now() - start,
            });
            throw AppError.validation(errors);
        }

        // Both normalizedFrom and normalizedTo are guaranteed to be strings here
        const participantsKey = createParticipantKey(normalizedFrom!, normalizedTo!);

        this.logger.debug('Normalized participants', {
            from: normalizedFrom,
            to: normalizedTo,
            participantsKey,
        });

        try {
            const conversation = await this.conversationRepo.findOrCreate(participantsKey);

            this.logger.info('Conversation ready', {
                conversationId: conversation.id,
                durationMs: Date.now() - start,
            });

            return conversation;
        } catch (error) {
            this.logger.error('Failed to find or create conversation', {
                participantsKey,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });
            throw AppError.internal('Failed to find or create conversation', {
                participantsKey,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Lists conversations with pagination.
     * Returns total count for pagination metadata.
     *
     * @param limit - Maximum conversations to return
     * @param offset - Number of conversations to skip
     * @returns Object containing conversations array and total count
     * @throws AppError if repository operation fails
     */
    async listConversations(params: {
        limit: number;
        offset: number;
    }): Promise<{
        conversations: ConversationResponse[];
        total: number;
    }> {
        const start = Date.now();

        this.logger.debug('Listing conversations', params);

        try {
            const [conversations, total] = await Promise.all([
                this.conversationRepo.findAll(params.limit, params.offset),
                this.conversationRepo.count(),
            ]);

            this.logger.info('Conversations listed', {
                count: conversations.length,
                total,
                durationMs: Date.now() - start,
            });

            return {
                conversations: conversations.map(toConversationResponse),
                total
            };
        } catch (error) {
            this.logger.error('Failed to list conversations', {
                ...params,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });
            throw AppError.internal('Failed to list conversations', {
                ...params,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Retrieves conversation metadata by ID.
     *
     * @param id - Conversation UUID
     * @returns The conversation record
     * @throws AppError.notFound if conversation doesn't exist
     * @throws AppError if repository operation fails
     */
    async getConversationMetadata(id: UUID): Promise<ConversationResponse> {
        const start = Date.now();

        this.logger.debug('Fetching conversation metadata', { id });

        try {
            const conversation = await this.conversationRepo.findById(id);

            if (!conversation) {
                this.logger.warn('Conversation not found', {
                    id,
                    durationMs: Date.now() - start,
                });
                throw AppError.notFound(`Conversation ${id} not found`);
            }

            this.logger.info('Conversation metadata retrieved', {
                id,
                durationMs: Date.now() - start,
            });

            return toConversationResponse(conversation);
        } catch (error) {
            // Re-throw AppError instances directly
            if (error instanceof AppError) {
                throw error;
            }

            this.logger.error('Failed to fetch conversation metadata', {
                id,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });
            throw AppError.internal('Failed to fetch conversation metadata', {
                id,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Retrieves conversation with its message history.
     *
     * @param id - Conversation UUID
     * @param messageLimit - Maximum messages to include
     * @returns Object containing conversation and messages array
     * @throws AppError.notFound if conversation doesn't exist
     * @throws AppError if repository operation fails
     */
    async getConversationWithMessages(
        id: UUID,
        messageLimit: number = 100
    ): Promise<ConversationWithMessages> {
        const start = Date.now();

        this.logger.debug('Fetching conversation with messages', { id, messageLimit });

        try {
            const conversation = await this.conversationRepo.findByIdWithMessages(id, messageLimit);

            if (!conversation) {
                this.logger.warn('Conversation not found', {
                    id,
                    durationMs: Date.now() - start,
                });
                throw AppError.notFound(`Conversation ${id} not found`);
            }

            this.logger.info('Conversation with messages retrieved', {
                id,
                messageCount: conversation.messages.length,
                durationMs: Date.now() - start,
            });

            return {
                ...toConversationResponse(conversation),
                messages: conversation.messages.map(toMessageResponse)
            };
        } catch (error) {
            // Re-throw AppError instances directly
            if (error instanceof AppError) {
                throw error;
            }

            this.logger.error('Failed to fetch conversation with messages', {
                id,
                messageLimit,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });
            throw AppError.internal('Failed to fetch conversation with messages', {
                id,
                messageLimit,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Deletes a conversation by ID.
     * Messages are cascaded via foreign key constraint.
     *
     * @param id - Conversation UUID
     * @throws AppError.notFound if conversation doesn't exist
     * @throws AppError if repository operation fails
     */
    async deleteConversation(id: UUID): Promise<void> {
        const start = Date.now();

        this.logger.debug('Deleting conversation', { id });

        try {
            const deleted = await this.conversationRepo.delete(id);

            if (!deleted) {
                this.logger.warn('Conversation not found for deletion', {
                    id,
                    durationMs: Date.now() - start,
                });
                throw AppError.notFound(`Conversation ${id} not found`);
            }

            this.logger.info('Conversation deleted', {
                id,
                durationMs: Date.now() - start,
            });
        } catch (error) {
            // Re-throw AppError instances directly
            if (error instanceof AppError) {
                throw error;
            }

            this.logger.error('Failed to delete conversation', {
                id,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });
            throw AppError.internal('Failed to delete conversation', {
                id,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
