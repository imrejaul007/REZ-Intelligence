FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Create logs directory
RUN mkdir -p /app/logs

# Copy package files and install production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist
COPY tsconfig.json ./

# Set environment
ENV NODE_ENV=production
ENV SERVICE_NAME=rez-whatsapp-bridge

# Expose port
EXPOSE 4010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4010/health || exit 1

# Start command
CMD ["node", "dist/index.js"]
