# 1. 后端构建环境
FROM node:22-alpine AS backend-builder

WORKDIR /app

COPY package.json ./
# 安装依赖后清理缓存
RUN yarn install && yarn cache clean

COPY . .
RUN yarn build

# 2. 前端构建环境
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY client/package.json ./client/
# 安装依赖后清理缓存
RUN cd client && yarn install && yarn cache clean

COPY client ./client
RUN cd client && yarn build

# 3. 生产环境
FROM node:22-alpine

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production

# 安装生产依赖并清理缓存
COPY package.json ./
RUN yarn install --production && yarn cache clean

# 从后端构建环境复制构建产物
COPY --from=backend-builder /app/dist ./dist
# 从前端构建环境复制构建产物
COPY --from=frontend-builder /app/client/dist ./client/dist

# 复制脚本并添加可执行权限
COPY scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

CMD ["./start.sh"]