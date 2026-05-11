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
| 代码质量 | ESLint, Prettier, Husky, lint-staged, commitlint |

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

- 使用 react-compiler，无需手动 `memo` / `useCallback`
- 组件代码顺序：state → function → useEffect
- 多个 zustand 状态使用 `useShallow` 避免 re-render
- 样式优先使用 Tailwind 原子类，动态类名用 `cn()` 工具函数
- 路由使用 `react-router`（已合并 react-router-dom）

### NestJS

- 模块结构：`module.ts` + `controller.ts` + `service.ts` + `dto/` + `entities/`
- 使用 class-validator 做 DTO 验证
- 全局异常过滤器：`common/filters/`
- Guard：`common/guards/`
- 装饰器：`common/decorators/`

## Git 规范

### Commit Message（commitlint 强制）

```
<type>(<scope>): <subject>

# 示例
feat(auth): add JWT refresh token
fix(socket): handle disconnect cleanup
refactor(api): extract shared HTTP client
```

type：`feat` / `fix` / `refactor` / `chore` / `style` / `docs` / `test`

### PR

- 使用 `.github/PULL_REQUEST_TEMPLATE.md` 模板
- 标题英文，body 中文
- 需要 assignees

## 注意事项

- 数据库 migration 文件在 `apps/server/database/`
- Docker 配置在 `docker/` 目录
- 环境配置在 `apps/server/src/config/env/`
