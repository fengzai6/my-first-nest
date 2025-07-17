# 第一个 NestJS 项目

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">
  <a href="https://github.com/fengzai6/my-first-nest/releases/latest">
    <img src="https://img.shields.io/github/v/release/fengzai6/my-first-nest" alt="Release">
  </a>
  <a href="https://github.com/fengzai6/my-first-nest/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/fengzai6/my-first-nest" alt="License">
  </a>
  <a href="https://github.com/fengzai6/my-first-nest/stargazers">
    <img src="https://img.shields.io/github/stars/fengzai6/my-first-nest" alt="Stars">
  </a>
</p>

## 项目简介

这是一个基于 [NestJS](https://nestjs.com/) 框架的入门级项目，由于在自学nestjs之路上，通过官方文档和搜索引擎所得到的教程都点到为止，并非是实现实际场景的业务，所以我便想完善实践，帮助开发者学习和实践 NestJS 的基础知识。本项目将实现一个简单又不简单的系统，展示 NestJS 的核心特性和最佳实践（个人学习中，可能存在错误），并将尽力的完善相关的注释。在项目的各个角落我也可能留下笔记帮助理解～

然后为了更好的展示项目功能，我添加了客户端（逐步对接中），或许也能帮助到学习前端的同学。

希望这个属于我的第一个 NestJS 项目，也能成为你的第一个 NestJS 项目参考🥰

**项目特点：** `最佳实践` `严格的TypeScript` `技术与时俱进` `代码可读性强` `功能完善` `技术栈覆盖广泛`

## 技术栈

- NestJS - 渐进式 Node.js 框架
- TypeScript - 类型安全的 JavaScript 超集
- TypeORM - 强大的 ORM 框架
- PostgreSQL - 关系型数据库
- Swagger - API 文档生成工具
- Redis - 缓存

### 客户端

- React
- Vite
- TailwindCSS
- ShadcnUI

## 项目特点

- 遵循 NestJS 最佳实践和项目结构
- 完整的 CRUD 操作示例
- 模块化设计
- 依赖注入的使用
- 数据验证和错误处理
- 基本的认证和授权

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
- [ ] 添加客户端来展示项目功能
  - [ ] 使用 React & Vite & TailwindCSS & ShadcnUI & Antd 制作客户端

### 计划功能 📋

- [ ] Redis 缓存集成
- [ ] session 管理
- [ ] 日志系统实现
- [ ] 文件上传功能
- [ ] 定时任务系统
- [ ] 单元测试与 E2E 测试
- [ ] Docker 容器化部署
- [ ] 国际化支持，统一管理响应信息，并根据用户语言返回不同的多语言
- [ ] 接口限流（全局或者指定配置）
- [ ] 第三方登录集成：GitHub等
- [ ] WebSocket 实时通信
- [ ] sse 实时通信
- [ ] 使用文档制作
  - [ ] 使用 Vitepress/Docusaurus 制作项目文档
- [ ] github action 自动化部署
  - [ ] 部署文档页面

## 快速开始

### 环境要求

- Node.js (>= 20.19.3)
- npm 或 yarn
- PostgreSQL

### 安装依赖

```bash
$ yarn install
```

### 配置环境变量

复制 `.env.example` 文件为 `.env`，并根据需要修改配置：

```bash
$ cp .env.example .env
```

### 运行项目

```bash
# 开发模式
$ yarn start:dev

# 生产模式
$ yarn start:prod
```

#### 初始化数据库

```bash
$ yarn db:init
```

#### 数据库生成迁移

```bash
$ yarn migration:generate <migration_name>
```

#### 客户端

```bash
$ cd client
$ yarn install
$ yarn dev
```

## 项目结构

```
.
├── database/                   # 数据库相关
│   ├── migrations/             # TypeORM 迁移文件
│   └── seeds/                  # 数据填充脚本 (初始化数据)
├── Dockerfile                  # Docker 配置文件
├── scripts/                    # 脚本文件
├── src/                        # 项目源码
│   ├── app.module.ts           # 应用根模块
│   ├── app.controller.ts       # 应用根控制器
│   ├── app.service.ts          # 应用根服务
│   ├── main.ts                 # 应用入口文件
│   ├── common/                 # 全局通用模块
│   │   ├── constants/          # 常量定义
│   │   ├── context/            # 请求上下文
│   │   ├── decorators/         # 自定义装饰器
│   │   ├── exceptions/         # 自定义异常
│   │   ├── filters/            # 全局过滤器
│   │   ├── guards/             # 全局守卫
│   │   ├── interceptors/       # 全局拦截器
│   │   ├── middleware/         # 中间件
│   │   ├── pipes/              # 全局管道
│   │   ├── response/           # 通用响应结构
│   │   └── subscribers/        # 数据库订阅器
│   ├── config/                 # 配置模块 (环境变量等)
│   ├── modules/                # 业务功能模块
│   │   ├── auth/               # 认证模块
│   │   ├── cats/               # 示例模块
│   │   ├── groups/             # 群组模块
│   │   ├── permissions/        # 权限模块
│   │   ├── roles/              # 角色模块
│   │   └── users/              # 用户模块
│   ├── shared/                 # 共享模块
│   │   ├── database/           # 数据库连接模块
│   │   ├── entity/             # 基础实体类 (如：审计字段)
│   │   ├── static/             # 静态资源模块
│   │   └── utils/              # 通用工具函数
│   └── types/                  # TypeScript 类型定义
└── test/                       # 测试
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
- 使用 husky 和 commitlint 进行 commit 规范

## 学习资源

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
