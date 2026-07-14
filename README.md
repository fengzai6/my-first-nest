# 第一个 NestJS 项目 - Monorepo

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">
  <a href="https://github.com/fengzai6/my-first-nest/stargazers">
    <img src="https://img.shields.io/github/stars/fengzai6/my-first-nest" alt="Stars">
  </a>
  <a href="https://github.com/fengzai6/my-first-nest/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/fengzai6/my-first-nest" alt="License">
  </a>
   <a href="https://first-nest-docs.qqwj.top/">
    <img src="https://img.shields.io/badge/docs-online-brightgreen" alt="Documentation">
  </a>
  <a href="https://github.com/fengzai6/my-first-nest/releases/latest">
    <img src="https://img.shields.io/github/v/release/fengzai6/my-first-nest" alt="Release">
  </a>
</p>

## 项目简介

这是一个基于 [NestJS](https://nestjs.com/) 框架的入门级项目，采用 **Monorepo** 架构管理。项目旨在帮助开发者学习和实践 NestJS 的基础知识，同时展示现代化的全栈开发最佳实践。

本项目包含：

- 🚀 **后端服务** (NestJS + TypeScript + TypeORM)
- 🎨 **前端应用** (React + TypeScript + Vite + Tailwind CSS)
- 📚 **文档站点** (VitePress + Vue 3)

采用 Yarn Workspace 进行包管理，实现代码共享和统一构建流程。

**项目特点：** `Monorepo架构` `最佳实践` `严格的TypeScript` `技术与时俱进` `代码可读性强` `功能完善` `技术栈覆盖广泛`

## 技术栈

### 🏗️ 架构

- **Yarn Workspace** - Monorepo 包管理
- **TypeScript** - 类型安全的 JavaScript 超集

### 🚀 后端 (Server)

- **NestJS** - 渐进式 Node.js 框架
- **TypeORM** - 强大的 ORM 框架
- **PostgreSQL** - 关系型数据库
- **Swagger** - API 文档生成工具
- **JWT** - 认证与授权
- **Socket.IO** - 实时双向通信
- **Redis** - 缓存

### 🎨 前端 (Web)

- **React 19** - 用户界面库
- **Vite** - 快速构建工具
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Ant Design** - 企业级 UI 设计语言
- **Zustand** - 轻量级状态管理
- **React Query** - 数据获取和缓存

### 📚 文档 (Docs)

- **VitePress** - 静态站点生成器
- **Vue 3** - 渐进式 JavaScript 框架
- **ECharts** - 数据可视化

### 🛠️ 开发工具

- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **Husky** - Git hooks
- **CommitLint** - 提交信息规范

## 项目特点

- 遵循 NestJS 最佳实践和项目结构
- 完整的 CRUD 操作示例
- 模块化设计
- 依赖注入的使用
- 数据验证和错误处理
- 基本的认证和授权
- WebSocket 实时通信（房间、点对点、广播、ACK 确认）
- 全链路 TypeScript 类型安全（Socket 事件类型约束）

## 项目路线图

### 已完成功能 ✅

- [x] 基础项目结构搭建
- [x] Swagger API 文档集成
- [x] TypeORM 数据库集成
- [x] 用户账号系统
- [x] 用户群组结构管理
- [x] JWT 认证与授权
- [x] 双 token 认证：AccessToken 和 RefreshToken
- [x] 数据库初始化和相关迁移工具
  - [x] migration 生成工具
  - [x] 数据库初始化脚本
  - [x] 数据库种子脚本
- [ ] RBAC 权限管理
  - [x] 核心 RBAC0：用户、角色、权限
  - [ ] 分级 RBAC1：角色继承，角色可以继承下级角色的权限
  - [ ] 约束 RBAC2：权限约束，强制职责分离，某些任务要求两个或多个角色共同完成
  - [ ] 对称 RBAC3：1 + 2, 并且可以获取组织拥有的权限，继承 Group，离开 Group 后，权限消失
- [x] 雪花算法作为 ID 生成器
- [x] 使用 joi 进行数据验证（环境变量）
- [x] WebSocket 实时通信
  - [x] NestJS WebSocket Gateway + Socket.IO
  - [x] JWT 鉴权守卫（WsJwtGuard）
  - [x] 房间管理（join/leave）
  - [x] 点对点消息、广播
  - [x] ACK 确认机制 + DTO 输入验证
  - [x] 全链路 TypeScript 事件类型约束
  - [x] React Hook 封装（useSocket）
- [ ] 添加客户端来展示项目功能
  - [ ] 使用 React & Vite & TailwindCSS & ShadcnUI & Antd 制作客户端
- [x] Redis 缓存集成

### 计划功能 📋

- [ ] session 管理
- [ ] 日志系统实现
- [ ] 文件上传功能
- [ ] 定时任务系统
- [ ] 单元测试与 E2E 测试
- [ ] Docker 容器化部署
- [ ] 国际化支持，统一管理响应信息，并根据用户语言返回不同的多语言
- [ ] 接口限流（全局或者指定配置）
- [ ] 第三方登录集成：GitHub等
- [x] WebSocket 实时通信
- [ ] sse 实时通信
- [ ] 使用文档制作
  - [ ] 使用 Vitepress/Docusaurus 制作项目文档
- [ ] github action 自动化部署
  - [ ] 部署文档页面

## 快速开始

### 环境要求

- **Node.js** (>= 20.19.5)
- **Yarn** (>= 4.0.0) 推荐使用 Yarn 进行包管理
- **PostgreSQL** (>= 12.0)

### 安装依赖

```bash
# 安装所有应用的依赖
yarn install
```

### 配置环境变量

复制 server 应用的环境变量文件：

```bash
cp apps/server/.env.example apps/server/.env
```

根据需要修改 `apps/server/.env` 文件中的配置。

### 运行项目

```bash
# 同时启动所有应用 (并行模式)
yarn dev

# 或者分别启动各个应用
yarn server:dev   # 启动后端服务器 (端口: 8080)
yarn web:dev      # 启动前端应用 (端口: 5173)
yarn docs:dev     # 启动文档站点 (端口: 5173)
```

### 数据库操作

```bash
# 初始化数据库
yarn workspace @my-first-nest/server db:init

# 生成迁移文件
yarn workspace @my-first-nest/server migration:generate <migration_name>

# 执行迁移
yarn workspace @my-first-nest/server db:migrate

# 填充种子数据
yarn workspace @my-first-nest/server db:seed
```

### 构建项目

```bash
# 构建所有应用
yarn build

# 或者分别构建
yarn server:build
yarn web:build
yarn docs:build
```

### 其他常用命令

```bash
yarn lint         # 运行所有应用的代码检查
yarn format       # 格式化所有代码
yarn test         # 运行所有测试
yarn clean        # 清理所有构建产物
```

## Docker

项目内置了 Docker 支持，方便您快速启动和部署应用。

### 启动服务

1.  **创建 Docker 外部网络**
    所有 Compose 文件都复用 `my-nest-network`，需要先创建一次。

    ```bash
    docker network create my-nest-network
    ```

2.  **启动数据库服务**
    此命令会启动一个 PostgreSQL 数据库容器，并将数据持久化到 `docker内的pg-data` 目录。

    ```bash
    docker-compose -f docker-compose.db.yml up -d
    ```

3.  **启动 Redis 缓存服务**
    `docker-compose.app.yml` 和 `docker-compose.local.yml` 已配置 `REDIS_URL`。配置 Redis 连接后，应用启动时会校验 Redis 连通性。

    ```bash
    docker-compose -f docker-compose.cache.yml up -d
    ```

4.  **启动应用服务**
    - **方式一：通过 Compose 构建和运行**
      此命令会自动构建前后端，并启动应用容器。

      ```bash
      docker-compose -f docker-compose.app.yml up --build -d
      ```

    - **方式二：运行本地已构建的镜像**
      首先，您需要在项目根目录手动构建镜像：
      ```bash
      docker build -t my-first-nest:local .
      ```
      然后，使用 `local` compose 文件启动它：
      ```bash
      docker-compose -f docker-compose.local.yml up -d
      ```

### 停止服务

要停止所有服务并移除容器，请在项目根目录下运行：

```bash
# 停止并移除数据库
docker-compose -f docker-compose.db.yml down

# 停止并移除 Redis 缓存
docker-compose -f docker-compose.cache.yml down

# 停止并移除应用
docker-compose -f docker-compose.app.yml down
# 或者
docker-compose -f docker-compose.local.yml down
```

## 项目结构

```
my-first-nest/                 # Monorepo 根目录
├── apps/                      # 应用程序
│   ├── server/                # 🚀 NestJS 后端服务
│   │   ├── database/          # 数据库相关
│   │   │   ├── migrations/    # TypeORM 迁移文件
│   │   │   └── seeds/         # 数据填充脚本
│   │   ├── src/               # 源代码
│   │   │   ├── common/        # 全局通用模块
│   │   │   ├── config/        # 配置模块
│   │   │   ├── modules/       # 业务功能模块
│   │   │   │   ├── auth/      # 认证模块
│   │   │   │   ├── users/     # 用户模块
│   │   │   │   ├── roles/     # 角色模块
│   │   │   │   ├── socket/    # WebSocket 实时通信模块
│   │   │   │   └── ...        # 其他模块
│   │   │   ├── shared/        # 共享模块
│   │   │   └── types/         # 类型定义
│   │   └── test/              # 测试
│   ├── web/                   # 🎨 React 前端应用
│   │   ├── src/
│   │   │   ├── components/    # 组件
│   │   │   ├── pages/         # 页面
│   │   │   ├── services/      # API 服务
│   │   │   ├── stores/        # 状态管理
│   │   │   ├── hooks/         # 自定义 Hooks（useSocket 等）
│   │   │   └── ...
│   │   └── public/            # 静态资源
│   └── docs/                  # 📚 VitePress 文档站点
│       ├── src/
│       │   ├── guide/         # 指南
│       │   ├── architecture/  # 架构说明
│       │   └── notes/         # 学习笔记
│       └── public/            # 静态资源
├── packages/                  # 🔧 共享包 (可选)
├── docker/                    # 🐳 Docker 配置
│   ├── docker-compose.app.yml
│   ├── docker-compose.db.yml
│   └── docker-compose.local.yml
├── scripts/                   # 📜 脚本文件
├── package.json              # 根包配置 (Monorepo 管理)
├── AGENTS.md                 # AI Agent 项目规则
└── ...                       # 其他配置文件
```

每个功能模块（如 `users`、`groups` 等）通常包含以下结构：

```
modules/xxx/
├── dto/            # 数据传输对象 (Data Transfer Objects)
├── entities/       # TypeORM 实体
├── xxx.controller.ts  # 控制器 (处理路由和 HTTP 请求)
├── xxx.service.ts    # 服务 (处理业务逻辑)
└── xxx.module.ts     # 模块定义 (组织模块依赖)
```

## 开发规范

- 使用 TypeScript 严格模式
- 遵循 RESTful API 设计规范
- 使用 DTO 进行数据验证
- 统一的错误处理
- 规范的代码注释
- 使用 ESLint 和 Prettier 保持代码风格一致
- Commit 规范由 CI / Code Review 约束

## 学习资源

- [项目文档](https://first-nest-docs.qqwj.top/)
- [NestJS 官方文档](https://docs.nestjs.com)
- [TypeScript 文档](https://www.typescriptlang.org/docs)
- [TypeORM 文档](https://typeorm.io)

## 希望各位帅哥美女

为了实现最佳实践，可以通过 issue 提出包括但不限于：

- 代码规范（如：命名规范、注释规范、代码风格等）
- 项目结构（如：模块划分、目录结构、文件命名等）
- 功能实现（如：功能实现、性能优化、安全问题等）

的建议，通过评估和讨论，我会尽力根据建议完善项目。

也可以通过 PR 直接提交您的最佳实践代码，提交 PR 之前，请先创建一个 issue，并描述您的最佳实践。并自己认领 issue （每个人都可以在别人的 issue 中认领并进行开发），在经过评估和讨论和完成之后，我会合并您的 PR。

感谢您的贡献！

## 许可证

[MIT licensed](LICENSE)
