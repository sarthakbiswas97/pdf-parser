.PHONY: build run test dev stop clean

# Local development
dev:
	docker compose up -d redis
	uvicorn src.server:app --host 0.0.0.0 --port 8000 --reload

# Docker
build:
	docker compose build

run:
	docker compose up

stop:
	docker compose down

# Tests
test:
	docker build --target test -t docparser-test .
	docker run --rm docparser-test python -m pytest tests/ -v

# Image size check
size:
	docker images docparser --format "{{.Repository}}:{{.Tag}} {{.Size}}"

clean:
	docker compose down -v
	docker image prune -f
