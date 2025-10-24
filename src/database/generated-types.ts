import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Conversations {
  created_at: Generated<Timestamp>;
  id: Generated<string>;
  last_message_at: Generated<Timestamp>;
  participants: string;
  updated_at: Generated<Timestamp>;
}

export interface Messages {
  attachments: string | null;
  body: string;
  conversation_id: string;
  created_at: Generated<Timestamp>;
  direction: string;
  error_message: string | null;
  from: string;
  id: Generated<string>;
  message_type: string;
  provider_message_id: string | null;
  provider_type: string;
  retry_count: Generated<number>;
  status: Generated<string>;
  timestamp: Timestamp;
  to: string;
}

export interface DB {
  conversations: Conversations;
  messages: Messages;
}
