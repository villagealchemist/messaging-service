# Messaging Aggregation API

### *One service to rule them all — and in the inbox bind them.*

A production-grade, **type-safe communication engine** forged with TypeScript, Express, and PostgreSQL. It unifies SMS, MMS, and Email into a single, cohesive interface.

> *Engineered for clarity, built for reliability, and infused with the meticulous touch of an alchemist.*

Built by [@villagealchemist](https://github.com/villagealchemist) • TypeScript • PostgreSQL • TSOA

---

## ⚡️ Features

* 📨 **Multi-Provider Support** — SMS, MMS, and Email in one unified API
* 🔗 **Intelligent Threading** — Automatic conversation grouping (A→B = B→A)
* 🔧 **Contact Normalization** — E.164 phone numbers, de-aliased emails
* 🎯 **Type-Safe Everything** — End-to-end TypeScript with runtime validation
* 📊 **Request Tracing** — Structured logging with unique request IDs
* 🏥 **Health Monitoring** — Database metrics and latency tracking
* 📖 **Auto-Generated Docs** — OpenAPI/Swagger always in sync
* 🗄️ **Version-Controlled Schema** — Kysely migrations
* 🔄 **Message Status Lifecycle** — `pending` → `sent` → `delivered` → `failed`
* 🧪 **Shell Test Suite** — Full API workflow validation via `bin/test.sh`

---

## 📑 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Quick Start](#-quick-start)
- [API Documentation](#-api-documentation)
- [Technical Stack](#-technical-stack)
- [Project Structure](#-project-structure)
- [Design Decisions](#-design-decisions)
- [Database Schema](#-database-schema)
- [Development](#-development)
- [Key Highlights for Interviewers](#-key-highlights-for-interviewers)

---

## 🏛 Architecture Overview

This service practices a **clean 3-tier separation**, keeping logic as elegant as it is maintainable:

```
Controllers (HTTP Layer)
    ↓
Services (Business Logic)
    ↓
Repositories (Data Access)
```

### Architectural Principles

- **Type Safety** — End-to-end TypeScript with runtime validation via TSOA
- **Stateless Repositories** — Pure I/O, zero logic
- **Service-Oriented** — Validation, normalization, orchestration
- **Thin Controllers** — Speak only HTTP
- **Single Responsibility** — Every piece has its place

> Like any well-brewed potion: every ingredient measured, every layer distinct.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start PostgreSQL container
docker-compose up -d

# Run database migrations
npm run migrate

# Seed database with sample data (optional)
npm run db:seed

# Start development server
npm run dev
```

The service will be available at `http://localhost:8080`

### Production

```bash
npm run build
npm start
```

---

## 📖 API Documentation

### Interactive Swagger

Access the auto-generated OpenAPI spec at:

**`http://localhost:8080/swagger.json`**

The spec is generated from TypeScript types and TSOA decorators — documentation always matches implementation.

### Endpoints at a Glance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/messages/sms` | Send SMS/MMS message |
| `POST` | `/api/messages/email` | Send Email message |
| `POST` | `/api/webhooks/sms` | Receive inbound SMS/MMS |
| `POST` | `/api/webhooks/email` | Receive inbound Email |
| `GET` | `/api/conversations` | List conversations (paginated) |
| `GET` | `/api/conversations/:id/metadata` | Get conversation details |
| `GET` | `/api/conversations/:id/messages` | Get message history |
| `DELETE` | `/api/conversations/:id` | Delete conversation |
| `GET` | `/api/health` | Health check + DB metrics |

### Example: Send SMS

```bash
curl -X POST http://localhost:8080/api/messages/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+12025551234",
    "to": "+12025555678",
    "type": "sms",
    "body": "Hello from the messaging service!",
    "attachments": null,
    "timestamp": "2025-10-24T12:00:00Z"
  }'
```

Response:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "conversationId": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
  "providerType": "sms",
  "messageType": "sms",
  "direction": "outbound",
  "from": "+12025551234",
  "to": "+12025555678",
  "body": "Hello from the messaging service!",
  "attachments": null,
  "status": "pending",
  "timestamp": "2025-10-24T12:00:00Z",
  "createdAt": "2025-10-24T12:00:01Z"
}
```

> Each route is both a spell and a promise: to deliver, to log, to persist.

---

## 🛠 Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 18+ | JavaScript runtime |
| **Language** | TypeScript 5.3 | Type-safe development |
| **Framework** | Express 4 | HTTP server |
| **Query Builder** | Kysely | Type-safe SQL |
| **Database** | PostgreSQL 15 | Relational store |
| **Validation** | TSOA | Runtime validation + OpenAPI |
| **Logging** | Winston | Structured JSON logs |
| **Migrations** | Kysely Migrator | Schema versioning |
| **Testing** | Jest + Supertest | Unit/integration tests |
| **Linting** | ESLint + Prettier | Code quality |

---

## 📁 Project Structure

```
messaging-service/
├── src/
│   ├── controllers/          # HTTP handlers (thin layer)
│   ├── services/             # Business logic orchestration
│   ├── repositories/         # Data access (pure I/O)
│   ├── database/             # Migrations & config
│   ├── models/               # Type definitions (consolidated)
│   ├── middleware/           # Express middleware
│   ├── utils/                # Normalizers, mappers, loggers
│   ├── errors/               # Custom error classes
│   ├── routes.ts             # Auto-generated by TSOA
│   ├── server.ts             # Express setup
│   └── app.ts                # Entry point
├── public/swagger.json       # Auto-generated OpenAPI spec
├── bin/
│   ├── start.sh              # Production startup
│   └── test.sh               # API test suite
├── docker-compose.yml
└── package.json
```

> A directory layout as deliberate as an alchemical circle — each file has its purpose, each layer its boundary.

---

## 🧠 Design Decisions

### 1. TSOA for API Contract Generation

**Why**: OpenAPI specs and runtime validation generated from TypeScript decorators.

**Benefits**: Single source of truth, zero drift, automatic validation.

### 2. Kysely Over Traditional ORMs

**Why**: Type-safe SQL without ORM abstraction overhead.

**Benefits**: Full SQL control, no N+1 queries, lightweight, transparent.

### 3. Repository Pattern

**Why**: Isolates database operations from business logic.

**Benefits**: Testable, mockable, swappable data sources.

### 4. Contact Normalization Strategy

**Why**: Ensures consistent conversation grouping regardless of input format.

**Implementation**:
- Phone: E.164 via `libphonenumber-js`
- Email: Lowercase + Gmail alias stripping
- Bidirectional key: `JSON.stringify([a, b].sort())`

**Result**: `(555) 123-4567` and `+15551234567` map to the same conversation.

### 5. Request-Scoped Logging

**Why**: Each request gets a unique ID and child logger for distributed tracing.

**Benefits**: Correlate logs, debug faster, structured JSON output.

### 6. Service-Level Error Transformation

**Why**: Repositories return raw data/undefined, services throw domain errors.

**Benefits**: Stateless repos, aggregated validation errors, consistent responses.

---

## 🗄 Database Schema

### Conversations

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `participants` | TEXT | JSON array of normalized contacts |
| `created_at` | TIMESTAMPTZ | Creation time |
| `updated_at` | TIMESTAMPTZ | Last update |
| `last_message_at` | TIMESTAMPTZ | Most recent message |

**Indexes**:
- `idx_conversations_last_message_at` (DESC)
- `idx_conversations_participants` (GIN)

### Messages

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `conversation_id` | UUID | FK to conversations |
| `provider_type` | TEXT | `sms` or `email` |
| `message_type` | TEXT | `sms`, `mms`, or `email` |
| `provider_message_id` | TEXT | Provider's ID |
| `direction` | TEXT | `inbound` / `outbound` |
| `from` | TEXT | Sender |
| `to` | TEXT | Recipient |
| `body` | TEXT | Message content |
| `attachments` | TEXT | JSON array of URLs |
| `status` | TEXT | Delivery status |
| `timestamp` | TIMESTAMPTZ | Message time |
| `created_at` | TIMESTAMPTZ | Record creation |
| `retry_count` | INTEGER | Retry attempts |
| `error_message` | TEXT | Error details |

**Indexes**:
- `idx_messages_conversation_timestamp`
- `idx_messages_provider_message_id`

**Constraints**:
- FK: `conversation_id` → `conversations.id` (CASCADE DELETE)
- Unique: `(provider_type, provider_message_id)` — prevents duplicate webhooks

> Tables forged like runes: each constraint a safeguard, each index a spell of speed.

---

## 🔧 Development

### Available Commands

```bash
# Development
npm run dev              # Hot reload dev server

# Building
npm run build            # Compile TS + generate routes/swagger

# Database
npm run migrate          # Run all migrations
npm run migrate:up       # Next migration
npm run migrate:down     # Rollback last
npm run migrate:reset    # Drop all tables
npm run db:seed          # Seed sample data
npm run db:codegen       # Generate Kysely types from schema
npm run db:reset         # Full reset: drop, migrate, codegen, seed

# Testing
npm test                 # Run Jest with coverage
npm run test:watch       # Watch mode
./bin/test.sh            # Shell script API tests

# Code Quality
npm run lint             # ESLint
npm run format           # Prettier
```

### Environment Variables

Create `.env`:

```bash
PORT=8080
NODE_ENV=development
DATABASE_URL=postgresql://messaging_user:messaging_password@localhost:5432/messaging_service
LOG_LEVEL=debug
```

### Migrations

Stored in `src/database/migrations/`, managed by Kysely Migrator.

**Create a migration**:
1. Add file: `migrations/002_add_field.ts`
2. Implement `up()` and `down()`
3. Run `npm run migrate:up`

**Rollback**:
```bash
npm run migrate:down
```

### Code Generation

**TSOA** (runs on build):
- `public/swagger.json` — OpenAPI spec
- `src/routes.ts` — Express routes

**Kysely Codegen**:
- `src/database/generated-types.ts` — DB types
- Run with `npm run db:codegen`

> Every command crafted for velocity, not chaos.

---

## 💡 Key Highlights for Interviewers

### 1. 🏗 Production-Grade Architecture
- Clean 3-tier: Controllers → Services → Repositories
- Repository pattern (testable, mockable)
- Zero circular dependencies
- Thin controllers, fat services

### 2. 🔒 Type Safety Everywhere
- End-to-end TypeScript
- Runtime validation (TSOA)
- Auto-generated types from DB schema
- No `any` types (strict config)

### 3. 🔍 Observability
- Request-scoped logging
- Unique request IDs
- Structured JSON logs
- Health endpoint with DB metrics

### 4. 🗂 Data Model Excellence
- Normalized contacts (E.164, de-aliased emails)
- Bidirectional conversation matching
- Provider-agnostic threading
- Optimized indexes (GIN, composite)

### 5. 🧑‍💻 Developer Experience
- Single-command setup
- Hot reload
- Version-controlled migrations
- Seeded test data
- Auto-generated docs

### 6. 🚦 Production Readiness
- Custom error classes
- Field-level validation
- Connection pooling
- Retry logic
- De-duplication (unique constraints)

### 7. ✨ Code Quality
- 28 TypeScript files (consolidated, no bloat)
- Professional inline docs
- ESLint + Prettier enforced
- Self-documenting code

---

## 👩‍🔬 Author

**Built with precision, poetry, and purpose.**

*— The Village Alchemist ([@villagealchemist](https://github.com/villagealchemist) / @opensourceress)*

> "Code should read like a spell: clear in intent, elegant in execution, and powerful in practice."
