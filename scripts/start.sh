#!/bin/sh

export NODE_ENV=${NODE_ENV:-production}

# 设置当脚本执行过程中，如果出现错误，则立即退出
set -e

# 在生产环境中，运行编译后的 JS 文件
if [ "$NODE_ENV" = "production" ]; then
  echo "Running in production mode..."
  # 初始化数据库
  node dist/database/manage.js init
  # 启动服务
  node dist/src/main
else
  echo "Running in development mode..."
  # 在开发环境中，使用 ts-node
  ts-node -r tsconfig-paths/register database/manage.ts init
  # 启动服务
  nest start
fi
