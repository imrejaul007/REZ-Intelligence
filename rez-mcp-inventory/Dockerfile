# rez-mcp-inventory/ Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 
CMD ["node", "dist/index.js"]
