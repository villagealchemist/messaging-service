import { Selectable } from 'kysely';
import { Conversations, Messages } from '../database/generated-types';
import {
    ConversationResponse,
    MessageResponse,
    ContactIdentifier,
    ProviderTypes,
    MessageTypes,
    MessageDirections,
    MessageStatuses,
} from '../models';

// Type Narrowing Utility

/**
 * Type-safe utility for narrowing a string to a specific literal type.
 * Validates that the value is in the allowed list at runtime.
 *
 * @param value - The string value to narrow
 * @param allowed - Readonly array of allowed literal values
 * @returns The narrowed value if valid
 * @throws Error if value is not in the allowed list
 *
 * @example
 * const providerType = narrow(dbValue, ProviderTypes); // 'sms' | 'email'
 */
function narrow<T extends string, U extends T>(
    value: T,
    allowed: readonly U[]
): U {
    if (allowed.includes(value as U)) {
        return value as U;
    }

    throw new Error(
        `Invalid value "${value}". Expected one of: ${allowed.join(', ')}`
    );
}

// Database to API Mappers

/**
 * Safely converts a timestamp (Date | string | undefined | null) → ISO string.
 * Returns current time if invalid or missing.
 */
function normalizeTimestamp(value: unknown): string {
    if (!value) return new Date().toISOString();

    if (value instanceof Date) {
        return value.toISOString();
    }

    const parsed = new Date(value as string);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

/**
 * Safely parses a JSON string, returning fallback on error.
 */
function safeJsonParse<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

/**
 * Maps a DB message (from select or aggregate) to API response shape.
 * Handles snake_case (aggregated) and camelCase (Kysely plugin).
 */
export function toMessageResponse(
    message: Partial<Selectable<Messages>> & Record<string, unknown>
): MessageResponse {
    const conversationId = (message.conversation_id ?? message.conversationId) as string;
    const providerType = (message.provider_type ?? message.providerType) as string;
    const messageType = (message.message_type ?? message.messageType) as string;
    const direction = (message.direction ?? 'outbound') as string;
    const status = (message.status ?? 'pending') as string;

    const createdAtRaw = message.created_at ?? message.createdAt;
    const timestampRaw = message.timestamp;

    const attachments = safeJsonParse<string[] | null>(message.attachments, null);

    return {
        id: message.id as string,
        conversationId,
        providerType: narrow(providerType, ProviderTypes),
        messageType: narrow(messageType, MessageTypes),
        direction: narrow(direction, MessageDirections),
        from: message.from as string,
        to: message.to as string,
        body: message.body as string,
        attachments,
        status: narrow(status, MessageStatuses),
        timestamp: normalizeTimestamp(timestampRaw),
        createdAt: normalizeTimestamp(createdAtRaw),
    };
}

/**
 * Maps a DB conversation entity to API response shape.
 * Handles camelCase or snake_case and parses participant JSON.
 */
export function toConversationResponse(
    conversation: Partial<Selectable<Conversations>> & Record<string, unknown>
): ConversationResponse {
    const participants = safeJsonParse<ContactIdentifier[]>(
        conversation.participants,
        []
    );

    const createdAtRaw = conversation.created_at ?? conversation.createdAt;
    const updatedAtRaw = conversation.updated_at ?? conversation.updatedAt;
    const lastMessageAtRaw = conversation.last_message_at ?? conversation.lastMessageAt;

    return {
        id: conversation.id as string,
        participants,
        createdAt: normalizeTimestamp(createdAtRaw),
        updatedAt: normalizeTimestamp(updatedAtRaw),
        lastMessageAt: normalizeTimestamp(lastMessageAtRaw),
    };
}
