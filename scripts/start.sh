#!/bin/sh

# 设置当脚本执行过程中，如果出现错误，则立即退出
set -e

echo "Running in production mode..."

# 初始化数据库
echo "Initializing database..."
node dist/database/manage.js init

# 启动服务
echo "Starting service..."
node dist/src/main
