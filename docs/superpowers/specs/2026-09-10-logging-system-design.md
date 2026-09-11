# 日志系统设计文档

**日期：** 2026-09-10
**状态：** 设计稿 v1

---

## 1. 设计目标

- 统一日志采集：覆盖 HTTP 请求、异常、WebSocket、定时任务、手动业务日志
- 持久化落库：日志写入 `LogRecord` 表，支持高效查询与保留策略
- 权限 API + 前端页面：`developer` 或 `super_admin` 特殊角色可查看和检索日志
- 外部系统兼容：输出结构化 JSON 行，支持 Seq 等外部日志系统消费
- 低侵入：不改业务控制器、不中断现有日志输出

## 2. 模块架构

日志系统作为共享模块 `shared/log/`，参考 `shared/jobs/` 结构：

```
src/shared/log/
├── log.module.ts          # 动态模块注册
├── log.service.ts         # 日志读写逻辑，对外提供业务日志方法
├── logger.service.ts      # 自定义 Logger，覆写 Nest Logger 接口
├── log.controller.ts      # RESTful API（developer 鉴权）
├── log-queue.service.ts   # BullMQ 生产者（推入队列）
├── log.processor.ts       # BullMQ 消费者（批量落库）
├── seq-transport.service.ts # Seq CLEF HTTP 发送器
├── entities/
│   └── log-record.entity.ts
├── dto/
│   └── query-log.dto.ts
├── interfaces/
│   └── log.interface.ts
└── constants/
    └── log.constants.ts
```

## 3. 数据模型

### 实体 LogRecord

| 字段         | 类型                   | 说明                                                       |
| ------------ | ---------------------- | ---------------------------------------------------------- |
| `id`         | `varchar (Snowflake)`  | 主键                                                       |
| `level`      | `varchar(16)`          | `debug / info / warn / error / fatal`                      |
| `category`   | `varchar(64)`          | 日志类别（`HTTP`、`Auth`、`Socket`、`Job`、`Business` 等） |
| `message`    | `text`                 | 日志消息                                                   |
| `context`    | `jsonb`                | 附加结构化数据                                             |
| `requestId`  | `varchar(64)` nullable | 请求链路 ID                                                |
| `userId`     | `varchar(64)` nullable | 当前用户 ID                                                |
| `ip`         | `varchar(45)` nullable | 客户端 IP（支持 IPv6）                                     |
| `method`     | `varchar(10)` nullable | HTTP 方法                                                  |
| `url`        | `text` nullable        | 请求 URL                                                   |
| `statusCode` | `smallint` nullable    | HTTP 状态码                                                |
| `duration`   | `integer` nullable     | 耗时（ms）                                                 |
| `stack`      | `text` nullable        | 异常栈                                                     |
| `timestamp`  | `timestamptz`          | 日志时间，默认 `now()`                                     |

### 索引

- `(timestamp DESC)` — 首页列表
- `(level, timestamp DESC)` — 按级别过滤
- `(category, timestamp DESC)` — 按类别过滤
- `(userId, timestamp DESC)` — 用户维度查询
- `(requestId)` — 请求链路聚合

### 保留策略

默认保留 30 天，通过 `RetentionConfig.logRetentionDays` 配置。利用已有 `@nestjs/schedule` 定时任务每日执行清理。

## 4. 采集流程

### 4.1 上下文传播

- **requestId**：在 `LoggingInterceptor.intercept()` 入口生成，存入 `AsyncLocalStorage`（复用 `user-context.ts` 的 ALS 或新建独立的 `requestContext`）。
- **userId**：使用已有 `UserContextInterceptor` 设置在 `request.user` 上的数据，从 ALS 读取。
- 所有日志消费者（拦截器、过滤器、LoggerService）自动读取 ALS 获取当前上下文。

### 4.2 HTTP 请求日志（LoggingInterceptor 改造）

当前 `LoggingInterceptor` 改为：

1.  生成 `requestId`，存入 ALS
2.  记录请求开始，收集 `method`、`url`、`ip`、`userId`、`category: 'HTTP'`
3.  响应完成后采集 `statusCode`、`duration`
4.  调用 `LoggerService.log()` 写入

不记录 `body` / `headers` / `query` 等敏感数据；如需记录由业务日志显式处理。

### 4.3 异常日志

改造 `GlobalExceptionsFilter`：

- 收集异常信息 + 当前请求上下文（method、url、userId、requestId）
- 提取栈信息
- 调用 `LoggerService.error()` 写入，level 为 `error` 或 `fatal`

### 4.4 业务日志

- 业务模块通过 `@Inject(LoggerService)` 注入，调用 `log()`、`warn()`、`error()` 方法
- 自动附带当前 ALS 上下文（requestId、userId）
- 需显式指定 `category` 参数

### 4.5 WebSocket / Socket 日志

- 在 `SocketGateway` / `SocketService` 中注入 `LoggerService`，指定 `category: 'Socket'`
- 巡检、连接/断开、房间操作等事件均写入（保留现有 `this.logger` 原有输出不变，新增 LoggerService）

### 4.6 定时任务 / 队列日志

- `ScheduledTasksModule` 中注入 `LoggerService`，指定 `category: 'ScheduledTask'`
- BullMQ 处理器中指定 `category: 'Job'`

### 4.7 队列写入

- `LogService` 写入时推入 `BullMQ` 队列（`log-queue`）
- `LogProcessor` 每批消费 50 条或每 5 秒 flush 一次，使用 `INSERT INTO log_record` 批量写入
- 写失败时降级到 stdout（不丢失消息），重试 2 次后丢弃

### 4.8 Seq 集成

**目标：** 所有日志同步输出到 Seq（或兼容的日志聚合系统），供运维和开发检索。

采用双层输出策略：

**第一层 —— 结构化 JSON stdout：**

- `LoggerService` 每次写入时同时输出一行结构化 JSON 到 stdout。
- JSON 字段映射为 Seq Compact JSON 格式：

  | Seq 字段     | 含义           | 取值                                      |
  | ------------ | -------------- | ----------------------------------------- |
  | `@t`         | UTC ISO 时间戳 | `timestamp`                               |
  | `@l`         | 日志级别       | `level`（首字母大写，如 `Info`、`Error`） |
  | `@m`         | 消息体         | `message`                                 |
  | `@x`         | 异常详情       | `stack`（仅当存在时）                     |
  | `logId`      | 应用日志 ID    | `id`（Snowflake）                         |
  | `requestId`  | 请求 ID        | `requestId`                               |
  | `user`       | 用户 ID        | `userId`                                  |
  | `category`   | 类别           | `category`                                |
  | `method`     | HTTP 方法      | `method`                                  |
  | `url`        | 请求路径       | `url`                                     |
  | `statusCode` | 状态码         | `statusCode`                              |
  | `duration`   | 耗时（ms）     | `duration`                                |
  | `ip`         | 客户端 IP      | `ip`                                      |
  | `context`    | 附加数据       | `context`                                 |

  示例输出行：

  ```json
  {
    "@t": "2026-09-10T12:34:56Z",
    "@l": "Error",
    "@m": "Invalid token",
    "@x": "...stack...",
    "requestId": "abc-123",
    "user": "u1",
    "category": "Auth",
    "method": "POST",
    "url": "/api/auth/login"
  }
  ```

- 在 Docker 环境下，容器 stdout 由 Docker logging driver 直接采集，或由 Seq Agent / Fluentd / Vector 收集。
- 本地开发时可直接用 `docker logs` 或 `journalctl` 查看。

**第二层 —— HTTP Push：**

- 配置 `SEQ_URL` 和 `SEQ_API_KEY` 后，`LogProcessor` 在批量落库的同时也将换行分隔的 CLEF JSON POST 至 Seq HTTP API（`/ingest/clef`）。
- 请求设置 `Content-Type: application/vnd.serilog.clef`；配置 API Key 时使用 `X-Seq-ApiKey` 请求头。
- 适合需要独立日志管道、不依赖容器 stdout 的场景。

**Seq 相关配置**（扩展第 7 节配置表）：

| 字段          | 默认值  | 说明                           |
| ------------- | ------- | ------------------------------ |
| `seq.enabled` | `false` | 是否启用 HTTP Push（v1 实现）  |
| `seq.url`     | —       | Seq 服务器地址（含协议和端口） |
| `seq.apiKey`  | —       | Seq API Key（如启用）          |

## 5. API 设计

### `GET /api/logs`

分页查询日志，需 `developer` 或 `super_admin` 特殊角色。

| 参数        | 类型         | 说明                        |
| ----------- | ------------ | --------------------------- |
| `page`      | int          | 页码，默认 1                |
| `pageSize`  | int          | 每页大小，默认 20，最大 100 |
| `level`     | string       | 过滤级别                    |
| `category`  | string       | 过滤类别                    |
| `userId`    | string       | 按用户 ID 过滤              |
| `requestId` | string       | 按请求链路聚合              |
| `startTime` | ISO datetime | 起始时间                    |
| `endTime`   | ISO datetime | 结束时间                    |
| `keyword`   | string       | 消息全文搜索（ILIKE）       |

响应格式复用现有统一响应，`data` 包含 `items[]` + `total`。

### `GET /api/logs/:id`

单条详情，返回完整字段（含 `context`、`stack`）。

### 权限

- 使用已有 `SpecialRolesGuard`
- 端点声明 `@SpecialRoles([SpecialRolesEnum.Developer, SpecialRolesEnum.SuperAdmin])`
- `developer` 与 `super_admin` 均可查询日志

## 6. 前端页面

- **路由**：`/logs`
- **目录**：`pages/logs/`（参考 `pages/management/` 风格）
- **布局**：嵌入 `AppSidebar` 左侧菜单，菜单标签"日志"
- **筛选栏**：时间范围选择器（日期+时间）、级别下拉、类别下拉、关键词输入、用户 ID 输入
- **表格列**：时间、级别（标签色）、类别、消息（截断 80 字符）、用户、`method + url`、耗时、操作
- **详情弹窗**：完整 `message`、`context`（JSON 格式化）、`stack`（代码块）、`requestId`、IP 等
- **分页**：Ant Design `Table` 内置分页

## 7. 配置

在 `config/configuration.interface.ts` 新增 `LogConfig`：

| 字段              | 默认值  | 说明                           |
| ----------------- | ------- | ------------------------------ |
| `retentionDays`   | `30`    | 日志保留天数                   |
| `batchSize`       | `50`    | 批量写入条数                   |
| `flushIntervalMs` | `5000`  | 批量刷新间隔（毫秒）           |
| `seq.enabled`     | `false` | 是否启用 Seq HTTP Push         |
| `seq.url`         | —       | Seq 服务器地址（含协议和端口） |
| `seq.apiKey`      | —       | Seq API Key                    |

通过 NestJS Config 注册，用已有 env 校验模式扩展 `LOG_RETENTION_DAYS` 等环境变量。

## 8. 测试策略

- **LoggerService**：单元测试验证上下文附加与消息格式化
- **LogService**：单元测试验证写入队列与查询逻辑
- **LogController**：集成测试验证权限与查询
- **LogProcessor**：集成测试验证队列消费与批量写入
- **SeqTransportService**：单元测试验证 CLEF 批量投递、认证请求头和失败重试
- **现有 Interceptor/Filter 改造**：补充改造后的行为测试

## 9. 外排

- 不记录 `body` / `headers` 到日志表，避免敏感信息泄漏
- 不修改现有业务控制器
- 不替换 NestJS 自带的 Logger（保留，仅新增 `LoggerService` 作为增强替代）
- 不在实时路径上同步写数据库
