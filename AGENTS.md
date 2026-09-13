# AGENTS.md

## 项目概述

NestJS + React 全栈 Monorepo 学习项目。

```
my-first-nest/
├── apps/
│   ├── server/    # NestJS + TypeORM + PostgreSQL
│   ├── web/       # React + Vite + Tailwind CSS + Ant Design
│   └── docs/      # VitePress 文档
├── packages/      # 共享包（暂空）
└── package.json   # Yarn Workspaces 根配置
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 包管理 | Yarn 4 (Berry) Workspaces |
| 后端 | NestJS 11, TypeORM, PostgreSQL, JWT, Passport, Socket.IO |
| 前端 | React 19, Vite, Tailwind CSS 4, Ant Design 5, Zustand, React Query |
| 文档 | VitePress |
| 代码质量 | ESLint, Prettier |

## 开发命令

```bash
# 安装依赖
yarn install

# 开发
yarn server:dev          # 启动后端 (localhost:8080)
yarn web:dev             # 启动前端 (localhost:5173)
yarn dev                 # 启动所有

# 构建
yarn server:build
yarn web:build
yarn build               # 构建所有

# 代码检查
yarn lint                # 所有 workspace
yarn format              # Prettier 格式化

# 测试
cd apps/server && yarn test
cd apps/web && yarn test
```

## 代码规范

### 命名

- 文件/目录：kebab-case（`user-profile/`）
- React 组件文件：PascalCase（`UserProfile.tsx`）
- 函数/变量：camelCase
- 常量：UPPER_CASE
- 类型/接口：PascalCase，接口加 `I` 前缀（`IUser`）
- API 函数：PascalCase（`GetUserById`）

### 文件结构

- 组件使用文件夹 + `index.tsx`：`components/user-card/index.tsx`
- 不使用桶导出（Barrel exports）
- 单文件超过 500 行考虑拆分

### TypeScript

- 禁止 `any`，优先使用项目已有的类型定义
- 使用 `as const` 替代 `enum`
- 优先使用 `structuredClone` 做深拷贝

### React

- 使用 ES6 箭头函数
- 使用 react-compiler，无需手动 `memo` / `useCallback`
- 组件代码顺序：state → function → useEffect
- 多个 zustand 状态使用 `useShallow` 避免 re-render
- 样式优先使用 Tailwind 原子类，动态类名用 `cn()` 工具函数
- 路由使用 `react-router`（已合并 react-router-dom）

### NestJS

- 模块结构：`module.ts` + `controller.ts` + `service.ts` + `dto/` + `entities/`
- 使用 class-validator 做 DTO 验证
- 使用 Pipes 做数据验证与转换
- 使用 Interceptors 做响应格式化、日志或缓存
- 全局异常过滤器：`common/filters/`
- Guard：`common/guards/`
- 装饰器：`common/decorators/`

### TypeORM

- 使用 Repository 模式进行数据库操作
- 使用事务管理确保数据一致性
- 遵循 DAL（Data Access Layer）最佳实践

### RESTful API

- 遵循标准 HTTP 方法（GET / POST / PUT / PATCH / DELETE）
- 使用恰当的 HTTP 状态码
- 资源导向的 URL 设计
- 需要时使用 query 参数做分页、筛选、排序
- PUT / DELETE 操作确保幂等性
- 使用 Swagger 装饰器（`@Api*`）生成 API 文档

### 通用编码

- 严格校验所有输入数据
- 关注基础安全实践（防 SQL 注入、XSS 等）
- 编写高效代码，避免不必要的计算和数据库查询
- 代码结构便于可测试性（单元测试、集成测试）
- 优先使用 `es-toolkit` 处理常见工具函数

### 注释与学习文档

代码注释与 `apps/docs/src/notes/` 笔记分工：注释只回答「这一行为什么这样写」，设计叙述写进笔记。

**代码注释**

- 只写代码表达不了的信息：理由、坑、约束、时序依赖。不复述代码行为，不解释框架语义（如 `@Global()`、`@Catch()` 本身的作用，查官方文档即可）。
- 贴着被解释的语句写在其正上方。不夹在参数列表中间、装饰器与 `class` 之间，也不挂在 import 块尾部。
- 一条注释一到两行。写不下说明是设计叙述，移到笔记。
- 一个事实只写一处：写在做出该决策的代码旁，其他文件不重复。
- 理由必须与代码实际行为一致，写前核对调用链。描述外部系统（Seq、BullMQ、PostgreSQL 等）的行为要有官方文档依据，不确定就不写。
- 格式：行级用 `// NOTE:` / `// HACK:` / `// FIXME:`；类或模块级用 JSDoc 块放在装饰器上方。
  - `NOTE:` 非显而易见的约束、隐式假设、时序依赖
  - `HACK:` 已知的权宜之计，附升级路径
  - `FIXME:` 已知缺陷或未完成项

**学习笔记**

- 新增模块或跨文件的设计决策，交付后写一篇笔记：源文件放模块目录的 `README.md`，`apps/docs/src/notes/` 用 `<!--@include: ...-->` 引入并登记到 `apps/docs/.vitepress/sidebars/notes.ts`；单文件小改动不写。
- 内容：整体流程、方案取舍（选了什么、比较过什么、为什么）、关键约束、已知限制。
- 只写最终结论，不写过程和中间尝试。

> 以上规则适用于 AI 助手和人工开发者。编写代码时主动留下上下文信息，能让本项目作为学习项目发挥更大价值 —— 阅读代码的人不仅要看到"做了什么"，更要理解"为什么这么做"。

## Git 规范

### Commit Message

```
<type>(<scope>): <subject>

# 示例
feat(auth): add JWT refresh token
fix(socket): handle disconnect cleanup
refactor(api): extract shared HTTP client
```

type：`feat` / `fix` / `refactor` / `chore` / `style` / `docs` / `test`

本地不再通过 husky/commitlint 强制校验，依赖 Code Review 与仓库约定约束。

### PR

- 使用 `.github/PULL_REQUEST_TEMPLATE.md` 模板
- 标题英文，body 中文
- 需要 assignees

## 注意事项

- 数据库 migration 文件在 `apps/server/database/`
- Docker 配置在 `docker/` 目录
- 环境配置在 `apps/server/src/config/env/`
