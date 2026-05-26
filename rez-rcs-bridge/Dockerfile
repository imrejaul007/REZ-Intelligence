# rez-rcs-bridge/ Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY dist ./dist

# Set environment
ENV NODE_ENV=production
ENV PORT=4140

# Expose port
EXPOSE 4140

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4140/health || exit 1

CMD ["node", "dist/index.js"]
