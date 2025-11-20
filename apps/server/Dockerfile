# ===========================================
# 基础镜像
# ===========================================
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ===========================================
# 依赖安装阶段
# ===========================================
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --filter @my-first-nest/server...

# ===========================================
# 构建阶段
# ===========================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY apps/server ./apps/server
WORKDIR /app/apps/server
RUN pnpm build

# ===========================================
# 生产依赖阶段
# ===========================================
FROM base AS prod-deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
RUN pnpm prune --prod

# ===========================================
# 运行阶段
# ===========================================
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/

# 复制生产依赖
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules

# 复制构建产物
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/database ./apps/server/database

# 复制启动脚本
COPY apps/server/scripts/start.sh ./apps/server/scripts/start.sh
RUN sed -i 's/\r$//' ./apps/server/scripts/start.sh && chmod +x ./apps/server/scripts/start.sh

EXPOSE 3000

CMD ["sh", "./apps/server/scripts/start.sh"]
