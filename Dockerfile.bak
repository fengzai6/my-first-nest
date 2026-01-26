# ===========================================
# 基础镜像 - 包含 Node.js 和 pnpm
# ===========================================
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ===========================================
# 依赖安装阶段 - 安装所有依赖用于构建
# ===========================================
FROM base AS deps
# 复制 workspace 配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# 复制各个应用的 package.json
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# 安装所有依赖（包括开发依赖，用于构建）
RUN pnpm install --frozen-lockfile

# ===========================================
# 后端构建阶段
# ===========================================
FROM base AS server-builder
# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

# 复制后端源代码和配置
COPY package.json pnpm-workspace.yaml ./
COPY apps/server ./apps/server

# 构建后端
WORKDIR /app/apps/server
RUN pnpm build

# ===========================================
# 前端构建阶段
# ===========================================
FROM base AS web-builder
# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# 复制前端源代码和配置
COPY package.json pnpm-workspace.yaml ./
COPY apps/web ./apps/web

# 构建前端
WORKDIR /app/apps/web
RUN pnpm build

# ===========================================
# 生产依赖准备阶段 - 从完整依赖中移除开发依赖
# ===========================================
FROM base AS prod-deps
# 复制完整的依赖（包括已编译的原生模块）
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

# 复制 workspace 配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/

# 移除开发依赖，保留生产依赖
RUN pnpm prune --prod

# ===========================================
# 最终生产镜像
# ===========================================
FROM base AS production

# 设置环境变量
ENV NODE_ENV=production

# 复制 workspace 配置
COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/

# 从生产依赖阶段复制 node_modules
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules

# 从后端构建阶段复制构建产物
COPY --from=server-builder /app/apps/server/dist ./apps/server/dist
COPY --from=server-builder /app/apps/server/database ./apps/server/database

# 从前端构建阶段复制构建产物
COPY --from=web-builder /app/apps/web/dist ./apps/web/dist

# 复制启动脚本
COPY scripts/start.sh ./scripts/start.sh
# 修复 Windows 换行符 (CRLF) 问题并添加可执行权限
RUN sed -i 's/\r$//' ./scripts/start.sh && chmod +x ./scripts/start.sh

# 暴露端口（根据实际配置调整）
EXPOSE 3000

# 启动应用
CMD ["sh", "./scripts/start.sh"]