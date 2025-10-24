#!/bin/bash

set -euo pipefail

echo "Starting Hatch Messaging Service"
echo "Environment: ${NODE_ENV:-development}"
echo "----------------------------------------"

# Ensure Docker is running
if ! docker ps > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker and re-run."
  exit 1
fi

# Start PostgreSQL container if not already running
if ! docker ps --format '{{.Names}}' | grep -q "postgres"; then
  echo "Starting PostgreSQL container..."
  docker-compose up -d postgres
fi

# Wait for PostgreSQL to become available
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep -m 1 'messaging' || true)
if [ -z "$POSTGRES_CONTAINER" ]; then
  echo "Error: No running Postgres container found. Check your docker-compose.yml."
  docker ps
  exit 1
fi

echo "Waiting for PostgreSQL container ($POSTGRES_CONTAINER) to become available..."
until docker exec "$POSTGRES_CONTAINER" pg_isready -U messaging_user -d messaging_service > /dev/null 2>&1; do
  sleep 1
done

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --silent
fi

# Run database migrations first
if [ -f "src/database/migrator.ts" ]; then
  echo "Running database migrations..."
  npx ts-node src/database/migrator.ts
else
  echo "No migration script found, skipping."
fi

# Seed the database (only in dev or test)
if [[ "${NODE_ENV:-development}" =~ ^(development|test)$ ]]; then
  echo "Seeding the database..."
  npx ts-node src/database/seed.ts || echo "Seed script failed, continuing..."
fi

# Start the API server
echo "Starting API server..."
npx ts-node src/server.ts

echo "Service running on http://localhost:8080"
