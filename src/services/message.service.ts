import { Logger } from 'winston';
import { Selectable } from 'kysely';
import { ConversationRepository } from '../repositories/conversation.repository';
import { MessageRepository } from '../repositories/message.repository';
import { Messages } from '../database/generated-types';
import { normalizeContact, createParticipantKey } from '../utils/normalizer';
import { toMessageResponse } from '../utils/mappers';
import { AppError, FieldError } from '../errors/appError';
import {
    ContactIdentifier,
    ProviderType,
    MessageType,
    MessageDirection,
    MessageStatus,
    UUID,
    CreateMessage,
    MessageResponse,
} from '../models';

/**
 * Payload for sending a message.
 * TSOA validates types at runtime (ContactIdentifier, enums, Date, etc.).
 */
export interface SendMessagePayload {
    providerType: ProviderType;
    providerMessageId?: string | null;
    messageType: MessageType;
    direction: MessageDirection;
    from: ContactIdentifier;
    to: ContactIdentifier;
    body: string;
    attachments?: string[] | null;
    timestamp: Date;
}

/**
 * Service layer for message business logic.
 * Performs semantic validation, normalization, and orchestrates repository calls.
 * Transforms repository errors into domain errors (AppError, ValidationError).
 */
export class MessageService {
    private readonly conversationRepo: ConversationRepository;
    private readonly messageRepo: MessageRepository;

    constructor(private readonly logger: Logger) {
        this.conversationRepo = new ConversationRepository(logger);
        this.messageRepo = new MessageRepository(logger);
    }

    /**
     * Unified entrypoint for both inbound and outbound messages.
     * Performs normalization, semantic validation, conversation resolution, and message persistence.
     * Aggregates all validation errors before throwing.
     *
     * @param payload - Message send payload (validated by TSOA)
     * @returns The persisted message record
     * @throws ValidationError if normalization or semantic validation fails
     * @throws AppError if repository operation fails
     */
    async sendMessage(payload: SendMessagePayload): Promise<MessageResponse> {
        const start = Date.now();
        const errors: FieldError[] = [];

        this.logger.debug('Processing message send', {
            providerType: payload.providerType,
            messageType: payload.messageType,
            direction: payload.direction,
            from: payload.from,
            to: payload.to,
        });

        // Normalize both participants, collecting errors
        let normalizedFrom: string | undefined;
        let normalizedTo: string | undefined;

        try {
            normalizedFrom = normalizeContact(payload.from);
        } catch (error) {
            errors.push({
                field: 'from',
                message: 'Invalid phone or email format',
                code: 'INVALID_CONTACT_FORMAT',
            });
        }

        try {
            normalizedTo = normalizeContact(payload.to);
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
                message: 'Message cannot be sent from a contact to itself',
                code: 'PARTICIPANTS_IDENTICAL',
            });
        }

        // Validate message body is non-empty
        if (!payload.body || payload.body.trim().length === 0) {
            errors.push({
                field: 'body',
                message: 'Message body cannot be empty',
                code: 'EMPTY_BODY',
            });
        }

        // Validate attachments for MMS
        if (payload.messageType === 'mms') {
            if (!payload.attachments || payload.attachments.length === 0) {
                errors.push({
                    field: 'attachments',
                    message: 'MMS messages must include at least one attachment',
                    code: 'MMS_REQUIRES_ATTACHMENTS',
                });
            }
        }

        // Validate provider/message type alignment
        if (payload.providerType === 'sms' && payload.messageType === 'email') {
            errors.push({
                field: 'messageType',
                message: 'Email message type cannot be sent via SMS provider',
                code: 'PROVIDER_MESSAGE_TYPE_MISMATCH',
            });
        }

        if (payload.providerType === 'email' && (payload.messageType === 'sms' || payload.messageType === 'mms')) {
            errors.push({
                field: 'messageType',
                message: 'SMS/MMS message type cannot be sent via email provider',
                code: 'PROVIDER_MESSAGE_TYPE_MISMATCH',
            });
        }

        // Throw aggregated validation errors if any exist
        if (errors.length > 0) {
            this.logger.warn('Message validation failed', {
                errors,
                durationMs: Date.now() - start,
            });
            throw AppError.validation(errors);
        }

        // Both normalizedFrom and normalizedTo are guaranteed to be strings here
        const participantsKey = createParticipantKey(normalizedFrom!, normalizedTo!);

        this.logger.debug('Normalized participants for message', {
            from: normalizedFrom,
            to: normalizedTo,
            participantsKey,
        });

        try {
            // Find or create conversation
            const conversation = await this.conversationRepo.findOrCreate(participantsKey);

            this.logger.debug('Conversation resolved', {
                conversationId: conversation.id,
            });

            // Derive message status based on direction
            const status: MessageStatus = payload.direction === 'outbound' ? 'pending' : 'delivered';

            // Construct repository payload
            const createParams: CreateMessage = {
                conversationId: conversation.id,
                providerType: payload.providerType,
                providerMessageId: payload.providerMessageId ?? null,
                messageType: payload.messageType,
                direction: payload.direction,
                from: payload.from,
                to: payload.to,
                body: payload.body,
                attachments: payload.attachments ?? null,
                status,
                timestamp: payload.timestamp,
            };

            // Persist message
            const message = await this.messageRepo.create(createParams);

            this.logger.info('Message persisted', {
                messageId: message.id,
                conversationId: conversation.id,
                status,
                durationMs: Date.now() - start,
            });

            return toMessageResponse(message);
        } catch (error) {
            this.logger.error('Failed to send message', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });

            // Re-throw AppError instances directly
            if (error instanceof AppError) {
                throw error;
            }

            throw AppError.internal('Failed to send message', {
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Retrieves a message by its unique ID.
     *
     * @param id - Message UUID
     * @returns The message record
     * @throws AppError.notFound if message doesn't exist
     * @throws AppError if repository operation fails
     */
    async getMessageById(id: UUID): Promise<Selectable<Messages>> {
        const start = Date.now();

        this.logger.debug('Fetching message by ID', { id });

        try {
            const message = await this.messageRepo.findById(id);

            if (!message) {
                this.logger.warn('Message not found', {
                    id,
                    durationMs: Date.now() - start,
                });
                throw AppError.notFound(`Message ${id} not found`);
            }

            this.logger.info('Message retrieved', {
                id,
                durationMs: Date.now() - start,
            });

            return message;
        } catch (error) {
            // Re-throw AppError instances directly
            if (error instanceof AppError) {
                throw error;
            }

            this.logger.error('Failed to fetch message by ID', {
                id,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });
            throw AppError.internal('Failed to fetch message by ID', {
                id,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Retrieves messages for a conversation.
     *
     * @param conversationId - Conversation UUID
     * @param limit - Maximum messages to return
     * @returns Array of messages ordered chronologically
     * @throws AppError if repository operation fails
     */
    async getMessagesByConversationId(
        conversationId: UUID,
        limit: number = 100
    ): Promise<Selectable<Messages>[]> {
        const start = Date.now();

        this.logger.debug('Fetching messages for conversation', { conversationId, limit });

        try {
            const messages = await this.messageRepo.findByConversationId(conversationId, limit);

            this.logger.info('Messages retrieved for conversation', {
                conversationId,
                count: messages.length,
                durationMs: Date.now() - start,
            });

            return messages;
        } catch (error) {
            this.logger.error('Failed to fetch messages for conversation', {
                conversationId,
                limit,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });
            throw AppError.internal('Failed to fetch messages for conversation', {
                conversationId,
                limit,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Updates the status of a message.
     *
     * @param id - Message UUID
     * @param status - New message status
     * @param errorMessage - Optional error message for failed statuses
     * @returns The updated message record
     * @throws AppError.notFound if message doesn't exist
     * @throws AppError if repository operation fails
     */
    async updateMessageStatus(
        id: UUID,
        status: MessageStatus,
        errorMessage?: string
    ): Promise<Selectable<Messages>> {
        const start = Date.now();

        this.logger.debug('Updating message status', { id, status, errorMessage });

        try {
            const message = await this.messageRepo.updateStatus(id, status, errorMessage);

            this.logger.info('Message status updated', {
                id,
                status,
                durationMs: Date.now() - start,
            });

            return message;
        } catch (error) {
            this.logger.error('Failed to update message status', {
                id,
                status,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });

            // Re-throw AppError instances directly
            if (error instanceof AppError) {
                throw error;
            }

            throw AppError.internal('Failed to update message status', {
                id,
                status,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Checks for duplicate inbound messages from provider.
     * Used to prevent processing the same webhook multiple times.
     *
     * @param providerType - Provider type (sms or email)
     * @param providerMessageId - Provider's unique message ID
     * @returns The existing message if found, undefined otherwise
     * @throws AppError if repository operation fails
     */
    async findDuplicateInboundMessage(
        providerType: ProviderType,
        providerMessageId: string
    ): Promise<Selectable<Messages> | undefined> {
        const start = Date.now();

        this.logger.debug('Checking for duplicate message', { providerType, providerMessageId });

        try {
            const message = await this.messageRepo.findByProviderMessageId(
                providerType,
                providerMessageId
            );

            if (message) {
                this.logger.warn('Duplicate message detected', {
                    providerType,
                    providerMessageId,
                    existingMessageId: message.id,
                    durationMs: Date.now() - start,
                });
            } else {
                this.logger.debug('No duplicate message found', {
                    providerType,
                    providerMessageId,
                    durationMs: Date.now() - start,
                });
            }

            return message;
        } catch (error) {
            this.logger.error('Failed to check for duplicate message', {
                providerType,
                providerMessageId,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - start,
            });
            throw AppError.internal('Failed to check for duplicate message', {
                providerType,
                providerMessageId,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
