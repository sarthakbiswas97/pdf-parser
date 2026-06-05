#!/bin/bash
# Redeploy DocParser backend on EC2
# Called by GitHub Actions or manually via SSH

set -e

APP_NAME="docparser"
IMAGE="ghcr.io/YOUR_GITHUB_USER/docparser:latest"
PORT=8000

echo "Pulling latest image..."
docker pull "$IMAGE"

echo "Stopping old container..."
docker stop "$APP_NAME" 2>/dev/null || true
docker rm "$APP_NAME" 2>/dev/null || true

echo "Starting new container..."
docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  -p "$PORT:8000" \
  --env-file /home/ubuntu/.env.docparser \
  -v /home/ubuntu/docparser-data:/app/data \
  "$IMAGE"

echo "Waiting for health check..."
sleep 5
if curl -sf http://localhost:$PORT/health > /dev/null; then
  echo "Healthy!"
else
  echo "Health check failed!"
  docker logs "$APP_NAME" --tail 20
  exit 1
fi

echo "Cleaning old images..."
docker image prune -f

echo "Deploy complete."
