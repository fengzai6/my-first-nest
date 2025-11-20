# 技术栈

- NestJS - 渐进式 Node.js 框架
- TypeScript - 类型安全的 JavaScript 超集
- TypeORM - 强大的 ORM 框架
- PostgreSQL - 关系型数据库
- Swagger - API 文档生成工具
- Redis - 缓存

## 客户端

- React
- Vite
- TailwindCSS
- ShadcnUI

# 项目结构

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
