FROM node:22-alpine AS base
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY apps/docs/package.json ./apps/docs/
RUN yarn install --immutable

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn workspace @my-first-nest/server build
RUN yarn workspace @my-first-nest/web build

FROM base AS prod-deps
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY apps/docs/package.json ./apps/docs/
RUN yarn workspaces focus @my-first-nest/server --production

FROM node:22-alpine AS runner
RUN apk add --no-cache nginx
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
COPY apps/server/package.json ./apps/server/

COPY --from=prod-deps /app/node_modules ./node_modules

COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/database ./apps/server/database
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY scripts/start.sh ./scripts/start.sh

RUN sed -i 's/\r$//' ./scripts/start.sh \
  && chmod +x ./scripts/start.sh \
  && mkdir -p /run/nginx

EXPOSE 80

CMD ["sh", "./scripts/start.sh"]
