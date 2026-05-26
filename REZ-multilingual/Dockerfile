FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
ENV NODE_ENV=production
ENV PORT=4150
EXPOSE 4150
CMD ["node", "dist/index.js"]
