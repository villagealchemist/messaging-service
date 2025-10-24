.PHONY: setup run test clean help db-up db-down db-logs db-shell build

help:
	@echo "Available commands:"
	@echo "  setup      - Build project and start database"
	@echo "  run        - Run the application"
	@echo "  test       - Run tests"
	@echo "  clean      - Clean up processes, temp files, and containers"
	@echo "  build      - Generate routes and compile TypeScript"
	@echo "  db-up      - Start the PostgreSQL database"
	@echo "  db-down    - Stop the PostgreSQL database"
	@echo "  db-logs    - Show database logs"
	@echo "  db-shell   - Connect to the database shell"
	@echo "  help       - Show this help message"

# ----------------------------------------
setup:
	@echo "> Setting up the project environment..."
	@make build
	@make db-up
	@echo "> Waiting for the database to initialize..."
	@sleep 5
	@echo "> Setup complete."

# ----------------------------------------
build:
	@echo "> Building project..."
	@npm run build

# ----------------------------------------
run:
	@echo "> Starting the application..."
	@./bin/start.sh

# ----------------------------------------
test:
	@echo "> Running test environment..."
	@make db-up
	@echo "> Running database seed..."
	@NODE_ENV=test npm run db:seed
	@echo "> Running test script..."
	@./bin/test.sh

# ----------------------------------------
clean:
	@echo "> Cleaning up..."
	@echo "> Killing anything on port 8080..."
	@lsof -ti :8080 | xargs kill -9 2>/dev/null || true
	@echo "> Stopping containers and removing volumes..."
	@docker-compose down -v
	@echo "> Cleaning temp files..."
	@rm -rf *.log *.tmp

# ----------------------------------------
db-up:
	@echo "> Starting PostgreSQL database..."
	@docker-compose up -d

db-down:
	@echo "> Stopping PostgreSQL database..."
	@docker-compose down

db-logs:
	@echo "> Showing database logs..."
	@docker-compose logs -f postgres

db-shell:
	@echo "> Connecting to database shell..."
	@docker-compose exec postgres psql -U messaging_user -d messaging_service
