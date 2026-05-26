FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY dist ./dist
COPY package*.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=4199

# Expose port
EXPOSE 4199

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4199/health || exit 1

# Start
CMD ["node", "dist/index.js"]
