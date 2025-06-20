#!/bin/sh

export NODE_ENV=production

# 设置当脚本执行过程中，如果出现错误，则立即退出
set -e

# 初始化数据库
ts-node database/manage.ts init

# 启动服务
node dist/main
