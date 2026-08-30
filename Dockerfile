FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
ENV ANTHROPIC_MODEL=claude-sonnet-5
ENV APP_VERSION=1.0.7
ENV APP_BUILD=local

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
