FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
ENV ANTHROPIC_MODEL=claude-sonnet-4-6

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
