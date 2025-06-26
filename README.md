# 我的第一个 NestJS 项目

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">
  <a href="https://github.com/fengzai6/my-first-nest/releases/latest">
    <img src="https://img.shields.io/github/v/release/fengzai6/my-first-nest" alt="Release">
  </a>
  <a href="https://github.com/fengzai6/my-first-nest/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/fengzai6/my-first-nest" alt="License">
  </a>
  <a href="https://github.com/fengzai6/my-first-nest/stargazers">
    <img src="https://img.shields.io/github/stars/fengzai6/my-first-nest" alt="Stars">
  </a>
</p>

## 项目简介

这是一个基于 [NestJS](https://nestjs.com/) 框架的入门级项目，旨在帮助开发者学习和实践 NestJS 的基础知识。本项目将实现一个简单的系统，展示 NestJS 的核心特性和最佳实践（个人认知中，可能存在错误），并将尽力的完善相关的注释。

## 技术栈

- NestJS - 渐进式 Node.js 框架
- TypeScript - 类型安全的 JavaScript 超集
- TypeORM - 强大的 ORM 框架
- PostgreSQL - 关系型数据库

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
- [x] JWT 认证与授权
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

### 计划功能 📋

- [ ] 使用 joi 进行数据验证（环境变量）
- [ ] 用户组织结构管理
- [ ] Redis 缓存集成
- [ ] 日志系统实现
- [ ] 文件上传功能
- [ ] 定时任务系统
- [ ] 消息队列集成
- [ ] 单元测试与 E2E 测试
- [ ] Docker 容器化部署
- [ ] 国际化支持
- [ ] 性能监控
- [ ] 自动化部署流程
- [ ] 接口限流
- [ ] 数据备份方案
- [ ] 第三方登录集成
- [ ] WebSocket 实时通信
- [ ] 使用文档生成
  - [ ] 使用 vitepress 生成文档
- [ ] github action 自动化部署
  - [ ] 部署文档页面

## 快速开始

### 环境要求

- Node.js (>= 18.x)
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

## 项目结构

```
src/
├── app.module.ts      # 应用程序根模块
├── app.controller.ts  # 应用程序控制器
├── app.service.ts     # 应用程序服务
├── main.ts           # 应用程序入口文件
├── modules/          # 功能模块目录
│   ├── users/       # 用户模块
│   ├── groups/      # 群组模块
│   ├── auth/        # 认证模块
│   └── cats/        # 示例模块
├── common/          # 通用工具和常量
├── config/          # 配置文件
├── shared/          # 共享模块和组件
└── types/           # TypeScript 类型定义
```

每个功能模块（如 users、groups 等）通常包含以下结构：

```
modules/xxx/
├── dto/            # 数据传输对象
├── entities/       # 数据库实体
├── xxx.controller.ts  # 控制器
├── xxx.service.ts    # 服务
└── xxx.module.ts     # 模块定义
```

## 开发规范

- 使用 TypeScript 严格模式
- 遵循 RESTful API 设计规范
- 使用 DTO 进行数据验证
- 统一的错误处理
- 规范的代码注释
- 使用 ESLint 和 Prettier 保持代码风格一致

## 学习资源

- [NestJS 官方文档](https://docs.nestjs.com)
- [TypeScript 文档](https://www.typescriptlang.org/docs)
- [TypeORM 文档](https://typeorm.io)

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目。

## 许可证

[MIT licensed](LICENSE)
