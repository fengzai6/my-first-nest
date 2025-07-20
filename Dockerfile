# 1. 后端构建环境
FROM node:22-alpine AS backend-builder

WORKDIR /app

COPY package.json yarn.lock ./
# 首先，只安装生产依赖
RUN yarn install --production
# 备份生产依赖
RUN cp -R node_modules /prod_node_modules

# 然后，安装所有依赖（包括开发依赖）以进行构建
RUN yarn install && yarn cache clean

COPY . .
RUN yarn build

# 2. 前端构建环境
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY client/package.json client/yarn.lock ./client/
# 安装依赖后清理缓存
RUN cd client && yarn install && yarn cache clean

COPY client ./client
RUN cd client && yarn build

# 3. 生产环境
FROM node:22-alpine

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production

# 从后端构建环境复制 package.json, yarn.lock 和生产依赖
COPY --from=backend-builder /app/package.json /app/yarn.lock ./
COPY --from=backend-builder /prod_node_modules ./node_modules

# 从后端构建环境复制构建产物
COPY --from=backend-builder /app/dist ./dist
# 从前端构建环境复制构建产物
COPY --from=frontend-builder /app/client/dist ./client/dist

# 复制脚本并添加可执行权限
COPY scripts/start.sh ./start.sh
# 修复 Windows 换行符 (CRLF) 问题
RUN sed -i 's/\r$//' ./start.sh && \
    chmod +x ./start.sh

CMD ["sh", "./start.sh"]