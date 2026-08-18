.DEFAULT_GOAL := help
PY := .venv/Scripts/python.exe
ifeq ($(OS),)
PY := .venv/bin/python
endif

.PHONY: help install lint test test-pg run worker migrate revision seed compose-up compose-down

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'

install: ## Install runtime + dev dependencies into .venv
	uv pip install -e ".[dev]"

lint: ## Ruff check
	$(PY) -m ruff check api

test: ## Run the test suite (SQLite; Postgres-only RLS tests skip)
	$(PY) -m pytest api/tests -q

test-pg: ## Run the suite including the Postgres RLS tests
	ROLEWIRE_TEST_PG_URL=postgresql+asyncpg://rolewire:rolewire@localhost:5432/rolewire_test $(PY) -m pytest api/tests -q

run: ## Start the API with autoreload
	cd api && ../$(PY) -m uvicorn app.main:app --reload --port 8000

worker: ## Start the arq worker
	cd api && ../$(PY) -m arq app.worker.WorkerSettings

migrate: ## Apply migrations
	cd api && ../$(PY) -m alembic upgrade head

revision: ## Autogenerate a migration: make revision m="add x"
	cd api && ../$(PY) -m alembic revision --autogenerate -m "$(m)"

seed: ## Create/update the default plans
	cd api && ../$(PY) -m app.cli seed-plans

compose-up: ## Bring up the dev stack
	docker compose up --build -d

compose-down: ## Tear down the dev stack (keeps volumes)
	docker compose down
