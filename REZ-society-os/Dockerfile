FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 4900

ENV NODE_ENV=production
ENV PORT=4900

CMD ["node", "dist/index.js"]
