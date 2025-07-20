# 快速开始

## 环境要求

- Node.js (>= 20.19.3)
- npm 或 yarn
- PostgreSQL

## 安装依赖

```bash
$ yarn install
```

## 配置环境变量

复制 `.env.example` 文件为 `.env`，并根据需要修改配置：

```bash
$ cp .env.example .env
```

## 运行项目

```bash
# 开发模式
$ yarn start:dev

# 生产模式
$ yarn start:prod
```

### 初始化数据库

```bash
$ yarn db:init
```

### 数据库生成迁移

```bash
$ yarn migration:generate <migration_name>
```

### 客户端

```bash
$ cd client
$ yarn install
$ yarn dev
```
