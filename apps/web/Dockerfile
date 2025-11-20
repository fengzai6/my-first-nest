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
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @my-first-nest/web...

# ===========================================
# 构建阶段
# ===========================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm build

# ===========================================
# 运行阶段 (Nginx)
# ===========================================
FROM nginx:alpine AS runner

# 复制构建产物到 Nginx 目录
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
