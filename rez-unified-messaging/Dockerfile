# ── Unified Messaging Service Dockerfile ──────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Install dependencies
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Production Stage ─────────────────────────────────────────────────────────
FROM node:18-alpine AS production
WORKDIR /app

# Security: Upgrade packages
RUN apk upgrade --no-cache

# Security: Install tini and wget for health check
RUN apk add --no-cache tini wget curl

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S messaging -u 1001

# Copy built application
COPY --from=builder --chown=messaging:nodejs /app/dist ./dist
COPY --from=builder --chown=messaging:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=messaging:nodejs /app/package.json ./package.json

# Set ownership
RUN chown -R messaging:nodejs /app

# Switch to non-root user
USER messaging

# Environment variables
ENV NODE_ENV=production \
    PORT=4025

EXPOSE 4025

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:4025/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
