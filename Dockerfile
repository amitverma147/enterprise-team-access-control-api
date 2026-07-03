# ============================================================================
# Multi-stage Dockerfile for the API itself (Phase 21 — Docker)
# ----------------------------------------------------------------------------
# For local development, prefer `npm run start:dev` on the host against the
# Postgres/Redis containers from docker-compose.yml (faster reload). This
# Dockerfile is for building a production-like image of the app itself.
#
# Build:  docker build -t eacapi:latest .
# Run:    docker run --env-file .env -p 3000:3000 eacapi:latest
# ============================================================================

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]
