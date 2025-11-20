# 项目架构

本项目的架构设计遵循了现代 Web 应用开发的最佳实践，旨在实现高内聚、低耦合、可扩展和易于维护的目标。我们采用了前后端分离的模式，后端使用 NestJS 框架，前端使用 React/Vite 技术栈。

## 概览

下图展示了项目的整体分层架构：

<script setup>
import ArchitectureChart from './ArchitectureChart.vue'
import ArchitectureFlowChart from './ArchitectureFlowChart.vue'
import TechStack from './TechStack.vue'
</script>

<ArchitectureFlowChart />

## 技术栈

<TechStack />

## 后端架构 (NestJS)

后端采用基于 NestJS 的模块化架构。这种设计使得代码结构清晰，易于管理和扩展。

### 1. 分层结构

- **Controllers (`/src/modules/*/controllers`):** 负责处理传入的 HTTP 请求，解析请求参数，并调用相应的服务处理业务逻辑。它们是应用的入口点。
- **Services (`/src/modules/*/services`):** 包含核心业务逻辑。服务被控制器调用，并与数据访问层进行交互。
- **Entities & Repositories (`/src/modules/*/entities`):** 使用 TypeORM 定义数据库实体（Entity），并通过 Repository 模式与数据库进行交互，实现数据的持久化。

### 2. 模块化 (`/src/modules`)

每个业务功能（如用户、角色、权限）都被划分为一个独立的模块。每个模块都封装了自己的控制器、服务和实体，从而实现了功能的内聚。

```
src/modules/
├── users/
│   ├── dto/
│   ├── entities/
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
└── ...
```

### 3. 通用与共享模块

- **`/src/common`**: 存放应用范围内的通用功能，如：
  - **Guards**: 用于路由权限控制。
  - **Interceptors**: 用于拦截和处理请求/响应流。
  - **Filters**: 用于处理全局异常。
  - **Decorators**: 自定义装饰器。
  - **Pipes**: 用于数据转换和验证。
- **`/src/shared`**: 存放可在不同模块之间共享的功能，如数据库连接、通用工具函数等。

### 4. 配置管理 (`/src/config`)

使用 `@nestjs/config` 模块管理环境变量，并根据不同的环境（开发、生产）加载不同的配置。

## 前端架构 (React)

前端应用使用 Vite 构建，采用 React 框架和 TypeScript。

### 1. 组件化结构

- **Pages (`/client/src/pages`):** 存放顶层页面组件，每个页面对应一个或多个路由。
- **Components (`/client/src/components`):** 存放可复用的 UI 组件，如按钮、表单、布局等。我们使用 `shadcn/ui` 作为基础组件库，并在此之上进行定制。
- **Layouts (Implicit):** 通过在 `app.tsx` 或路由配置中组合组件来实现不同的页面布局。

### 2. 状态管理

使用 `Zustand` 进行全局状态管理。`Zustand` 以其简洁的 API 和基于 Hooks 的用法，能够轻松地管理用户认证状态、全局配置等。

### 3. 数据请求

通过 `axios` 封装的 API 服务层 (`/client/src/services/api`) 来与后端进行通信。这有助于统一处理请求/响应、错误和认证 Token。

### 4. 路由

使用 `react-router-dom` 进行客户端路由管理，并通过路由守卫 (`/client/src/router/auth-guard.tsx`) 实现对需要认证的页面的保护。

## 数据库

- **数据库类型**: 使用 PostgreSQL，一个功能强大的开源对象-关系型数据库。
- **ORM**: 使用 TypeORM 来进行对象关系映射，简化了数据库操作。
- **数据迁移与填充**:
  - **Migrations (`/database/migrations`):** 用于管理数据库结构的版本变更。
  - **Seeds (`/database/seeds`):** 用于在数据库初始化时填充必要的初始数据（如默认角色、权限等）。

这种架构设计旨在提供一个稳健、可扩展的基础，方便未来添加新功能和进行维护。

## 项目结构可视化

<ArchitectureChart />
