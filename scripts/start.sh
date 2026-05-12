#!/bin/sh

# 启动脚本：在单个容器内同时运行 Nest 服务和 Nginx
# - Nest 服务监听 3000 端口，处理 API 请求和 WebSocket
# - Nginx 监听 80 端口，负责静态资源托管和反向代理

# 任何命令失败时立即退出
set -e

# ============================================
# 1. 初始化数据库（执行迁移和种子数据）
# ============================================
echo "Initializing database..."
node apps/server/dist/database/manage.js init

# ============================================
# 2. 启动 Nest 后台服务
# ============================================
echo "Starting Nest server..."
node apps/server/dist/src/main &
server_pid=$!

# ============================================
# 3. 启动 Nginx 前端服务器
# ============================================
echo "Starting Nginx..."
nginx -g 'daemon off;' &
nginx_pid=$!

# ============================================
# 优雅关闭：收到终止信号时清理所有子进程
# ============================================
shutdown() {
  kill -TERM "$server_pid" 2>/dev/null || true
  kill -TERM "$nginx_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  wait "$nginx_pid" 2>/dev/null || true
}

# 捕获 SIGINT (Ctrl+C) 和 SIGTERM (docker stop) 信号
trap 'shutdown; exit 143' INT TERM

# ============================================
# 4. 健康监控循环：任一进程异常退出则整体退出
# ============================================
while true; do
  # 检查 Nest 服务是否仍在运行
  if ! kill -0 "$server_pid" 2>/dev/null; then
    server_exit=0
    wait "$server_pid" || server_exit=$?
    echo "Nest server exited with code $server_exit, shutting down..."
    kill -TERM "$nginx_pid" 2>/dev/null || true
    wait "$nginx_pid" 2>/dev/null || true
    exit "$server_exit"
  fi

  # 检查 Nginx 是否仍在运行
  if ! kill -0 "$nginx_pid" 2>/dev/null; then
    nginx_exit=0
    wait "$nginx_pid" || nginx_exit=$?
    echo "Nginx exited with code $nginx_exit, shutting down..."
    kill -TERM "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
    exit "$nginx_exit"
  fi

  sleep 1
done
