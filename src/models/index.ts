/**
 * Type definitions for the Messaging Service.
 * Comprehensive type system covering primitives, enums, DB schemas,
 * API requests/responses, and validation.
 *
 * This is the single source of truth for all types across the application.
 */

import { Generated } from 'kysely';

// Primitive Types & Aliases

/**
 * UUIDv4 identifier.
 * @pattern ^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$
 * @format uuid
 * @maxLength 36
 * @example "550e8400-e29b-41d4-a716-446655440000"
 */
export type UUID = string;

/**
 * RFC 5322–compliant email address.
 * @pattern ^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$
 * @format email
 * @example "user@example.com"
 */
export type EmailAddress = string;

/**
 * E.164 international phone number.
 * @pattern ^\+[1-9]\d{7,14}$
 * @format phone
 * @example "+12155551212"
 */
export type PhoneNumber = string;

/**
 * Contact identifier — may be an email or phone number.
 */
export type ContactIdentifier = EmailAddress | PhoneNumber;

/**
 * ISO-8601 timestamp string.
 * @isDateTime
 * @example "2025-10-23T18:32:00Z"
 */
export type ISODateTimeString = string;

// Enums

/**
 * Provider types supported by the messaging service.
 */
export const ProviderTypes = ['sms', 'email'] as const;
export type ProviderType = (typeof ProviderTypes)[number];

/**
 * Supported text-based message formats.
 */
export const TextMessageTypes = ['sms', 'mms'] as const;
export type TextMessageType = (typeof TextMessageTypes)[number];

/**
 * All supported message formats.
 */
export const MessageTypes = ['sms', 'mms', 'email'] as const;
export type MessageType = (typeof MessageTypes)[number];

/**
 * Message direction relative to our system.
 */
export const MessageDirections = ['inbound', 'outbound'] as const;
export type MessageDirection = (typeof MessageDirections)[number];

/**
 * Message status lifecycle.
 */
export const MessageStatuses = ['pending', 'sent', 'delivered', 'failed'] as const;
export type MessageStatus = (typeof MessageStatuses)[number];

// Database Schemas

/**
 * Database representation of a conversation.
 * Column names reflect actual database (snake_case).
 */
export interface ConversationTable {
    id: Generated<UUID>;
    participants: string;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    last_message_at: Generated<Date>;
}

/**
 * Messages table schema.
 */
export interface MessageTable {
    id: Generated<UUID>;
    conversation_id: UUID;
    provider_type: ProviderType;
    message_type: MessageType;
    provider_message_id: string | null;
    direction: MessageDirection;
    from: ContactIdentifier;
    to: ContactIdentifier;
    body: string;
    attachments: string | null;
    status: MessageStatus;
    timestamp: Date;
    created_at: Generated<Date>;
    retry_count: number;
    error_message: string | null;
}

/**
 * Base payload for message operations (outbound/inbound).
 */
export interface MessagePayload {
    providerType: ProviderType;
    providerMessageId?: string | null;
    messageType: MessageType;
    direction: MessageDirection;
    from: ContactIdentifier;
    to: ContactIdentifier;
    body: string;
    attachments?: string[] | null;
    timestamp: Date | ISODateTimeString;
}

/**
 * Input payload for inserting a message into persistence.
 * Used internally by the MessageRepository.
 */
export interface CreateMessage extends MessagePayload {
    conversationId: UUID;
    status: MessageStatus;
}

// API Request Types

/**
 * Outbound SMS/MMS request payload.
 * Used when clients want to send a text message.
 */
export interface OutboundSmsRequest {
    from: ContactIdentifier;
    to: ContactIdentifier;
    body: string;
    attachments: string[] | null;
    timestamp: ISODateTimeString;
    type: TextMessageType;
}

/**
 * Outbound email request payload.
 * Used when clients want to send an email.
 */
export interface OutboundEmailRequest {
    from: EmailAddress;
    to: EmailAddress;
    body: string;
    attachments: string[] | null;
    timestamp: ISODateTimeString;
}

/**
 * Inbound SMS/MMS webhook payload.
 * Received from SMS provider when a message arrives.
 */
export interface InboundSmsWebhook {
    from: ContactIdentifier;
    to: ContactIdentifier;
    body: string;
    attachments: string[] | null;
    timestamp: ISODateTimeString;
    type: TextMessageType;
    messaging_provider_id: string;
}

/**
 * Inbound email webhook payload.
 * Received from email provider when a message arrives.
 */
export interface InboundEmailWebhook {
    from: EmailAddress;
    to: EmailAddress;
    xillio_id: string;
    body: string;
    attachments: string[] | null;
    timestamp: ISODateTimeString;
}

/**
 * Pagination parameters for list endpoints.
 */
export interface PaginationQuery {
    limit?: number;
    offset?: number;
}

// API Response Types

/**
 * API response for a single message.
 */
export interface MessageResponse {
    id: UUID;
    conversationId: UUID;
    providerType: ProviderType;
    messageType: MessageType;
    direction: MessageDirection;
    from: ContactIdentifier;
    to: ContactIdentifier;
    body: string;
    attachments: string[] | null;
    status: MessageStatus;
    timestamp: ISODateTimeString;
    createdAt: ISODateTimeString;
}

/**
 * API response for a conversation without messages.
 * Used in list endpoints for efficiency.
 */
export interface ConversationResponse {
    id: UUID;
    participants: ContactIdentifier[];
    createdAt: ISODateTimeString;
    updatedAt: ISODateTimeString;
    lastMessageAt: ISODateTimeString;
    messageCount?: number;
    lastMessage?: MessageResponse;
}

/**
 * API response for a conversation with full message history.
 * Used in detail endpoints.
 */
export interface ConversationWithMessages extends ConversationResponse {
    messages: MessageResponse[];
}

/**
 * Standard API error response.
 */
export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
}

/**
 * Health check endpoint response.
 */
export interface HealthCheckResponse {
    status: 'healthy' | 'unhealthy';
    timestamp: ISODateTimeString;
    uptime: number;
    database: {
        connected: boolean;
        latencyMs?: number;
    };
}
