# 日志系统

> 这个目录是项目级日志基础设施。业务代码只注入 `LoggerService` 写日志；落库、Seq 投递和查询接口都在这里完成。
> 依赖 Redis（BullMQ 队列）和 PostgreSQL，Seq 可选。

## 1. 整体链路

```
业务代码 / 拦截器 / 过滤器
        │  logger.log / warn / error / debug
        ▼
LoggerService.write()
  ├─ 补全上下文：requestId、userId、ip、method、url（来自 AsyncLocalStorage）
  ├─ 同步：process.stdout ← 开发 TTY 多行文本，其他环境 CLEF JSON
  └─ 异步：LogQueueService.enqueue()
              │  攒满 batchSize 或到 flushIntervalMs 就 flush 一批
              ▼
        BullMQ 队列 log-queue（job persist-log-batch，attempts 3，固定退避 1s）
              │
              ▼
        LogProcessor.process()
          ├─ 1) LogService.insertIgnoreConflicts()  → PostgreSQL log_records
          └─ 2) SeqTransportService.send()          → Seq /ingest/clef（SEQ_ENABLED 时）
```

两条通道各管一件事：stdout 保证本地和容器里随时能看到日志；队列把落库和外发从请求路径上摘掉，业务请求不等待这些 IO。开发环境由终端直接运行时，stdout 输出按人类阅读习惯格式化的多行文本；非 TTY 和生产环境输出单行 CLEF JSON，方便容器采集与检索。

## 2. 目录结构

```
apps/server/src/shared/log/
├── README.md                    # 本文档
├── log.module.ts                # @Global LogModule，导出 LoggerService / LogService
├── logger.service.ts            # 业务写日志的入口
├── log-queue.service.ts         # 内存缓冲 + 批量入队
├── log.processor.ts             # BullMQ Worker：落库 + 投 Seq
├── log.service.ts               # 落库、清理、查询
├── seq-transport.service.ts     # Seq HTTP 投递
├── clef.ts                      # ILogEvent → CLEF JSON
├── console-log.formatter.ts     # stdout 终端格式与 CLEF JSON 输出
├── log.controller.ts            # GET /api/logs、GET /api/logs/:id
├── constants/log.constants.ts   # 级别、类别、队列名
├── dto/query-log.dto.ts         # 查询参数校验
├── entities/log-record.entity.ts
└── interfaces/log.interface.ts
```

相关但不在本目录：

- `common/context/request-context.ts`、`common/middleware/request-context.middleware.ts`：请求上下文
- `common/interceptors/user-context.interceptor.ts`：JWT 守卫之后把 userId 写进请求上下文
- `common/interceptors/logging.interceptor.ts`：每个成功请求记一条 `HTTP request completed`
- `common/filters/global-exception.filter.ts`：每个失败请求记一条 `HTTP request failed`（error 级，带堆栈）
- `common/filters/ws-exception.filter.ts`：WsException 记 warn
- `modules/scheduled-tasks/cleanup-expired-logs.scheduler.ts`：每天 02:00 清理过期日志
- `database/migrations/20260910190421-create-log-records.ts`：建表与索引

## 3. 写日志

```ts
constructor(private readonly logger: LoggerService) {}

this.logger.log('Socket room joined', {
  category: LOG_CATEGORY.SOCKET,
  context: { socketId, room },
});

this.logger.error('HTTP request failed', exception, {
  category: LOG_CATEGORY.HTTP,
  statusCode: 500,
});
```

- 级别：`debug` / `info`（对应 `log()`）/ `warn` / `error`。常量里还定义了 `fatal`，LoggerService 暂未暴露对应方法。
- 类别 `LOG_CATEGORY`：`HTTP`、`Auth`、`Socket`、`Job`、`ScheduledTask`、`Business`（默认）。
- `error()` 第二个参数传原始异常，会自动填 `stack`。
- `options` 里显式传的 `requestId` / `userId` / `ip` / `method` / `url` 优先于请求上下文。

### 请求上下文

`requestContextMiddleware` 用 Node 内置 `AsyncLocalStorage` 为每个 HTTP 请求开一个 store：`requestId`（randomUUID）、`startedAt`、`method`、`url`、`ip`。`UserContextInterceptor` 在 JWT 守卫之后补上 `userId`。LoggerService 读 `getStore()` 自动填充，业务代码不用层层传参。

只有 HTTP 链路有 store。cron、BullMQ processor、WebSocket 处理函数里 `getStore()` 是 `undefined`，对应字段落成 `null`；需要关联时在 `options` 里显式传。

## 4. 存储与保留

表 `log_records`，实体 `LogRecord` 不继承 `BaseEntity`：日志只追加不修改，没有 `updatedAt` / `deletedAt`。

- `id`：bigint 主键，雪花 ID，应用层生成
- `level`、`category`、`message`：varchar(16)、varchar(64)、text
- `context`：jsonb，业务自定义字段
- `requestId`、`userId`、`ip`、`method`、`url`、`statusCode`、`duration`、`stack`：可空，HTTP 相关字段
- `timestamp`：timestamptz，事件发生时间，不是入库时间

索引：`timestamp`、`(level, timestamp)`、`(category, timestamp)`、`(userId, timestamp)`、`requestId`。复合索引等值列在前、时间列在后，一个索引同时服务 `WHERE level = ? AND timestamp BETWEEN ...` 和 `ORDER BY timestamp DESC` 分页。

保留：`CleanupExpiredLogsScheduler` 每天 02:00 物理删除 `timestamp < now - LOG_RETENTION_DAYS`（默认 30 天）。不做软删除，日志量大，软删除只会让表和索引持续膨胀。

## 5. 查询接口与权限

- `GET /api/logs`：按 `level`、`category`、`userId`、`requestId`、`startTime`、`endTime`、`keyword`（message ILIKE）筛选，`page` / `pageSize`（最大 100），按 timestamp 倒序。
- `GET /api/logs/:id`：id 不是合法 bigint 或记录不存在都返回 `LOG_NOT_FOUND`。
- 控制器挂 `SpecialRolesGuard`，只允许 `developer` / `super_admin`。
- 前端侧边栏按角色隐藏「日志」菜单，这只是体验优化；直接访问 `/logs` 页面能打开，接口会返回 403。

## 6. Seq 与 CLEF

Seq 以及非 TTY / 生产环境的 stdout 使用 CLEF（Compact Log Event Format）JSON，`clef.ts` 负责映射；开发 TTY 的 stdout 是多行文本，不应按 CLEF JSON 解析：

- `@t`：timestamp（ISO 8601）
- `@l`：level 首字母大写（`Info`、`Error`）
- `@m`：message
- `@x`：stack，有才写
- `logId`、`requestId`、`userId`、`category`、`method`、`url`、`statusCode`、`duration`、`ip`、`context`：普通属性

不用 CLEF 的 `@i`：Seq 把它当作事件类型（Serilog 约定为消息模板哈希）把同类事件归到一起，不是每条记录的唯一 ID；每条唯一的雪花 ID 放在普通字段 `logId`。

Seq 投递：`POST {SEQ_URL}/ingest/clef`，`Content-Type: application/vnd.serilog.clef`，配置了 API Key 时带 `X-Seq-ApiKey`，只接受 201。本地用 `docker/docker-compose.seq.yml` 启动 `datalust/seq`，UI 在 `http://localhost:5341`。

## 7. 配置

- `LOG_RETENTION_DAYS`（默认 30）：保留天数
- `LOG_BATCH_SIZE`（默认 50）：攒多少条就 flush
- `LOG_FLUSH_INTERVAL_MS`（默认 5000）：不满一批时最长等多久，毫秒
- `SEQ_ENABLED`（默认 false）：为 `true` 且 `SEQ_URL` 可达时才投递
- `SEQ_URL`：例如 `http://localhost:5341`
- `SEQ_API_KEY`：可选
- `SEQ_TIMEOUT_MS`（默认 5000）：单次投递超时，毫秒

队列复用 `JobQueueModule` 的 Redis 连接，Redis 未配置时应用启动即报错。

## 8. 设计取舍

**先落库，再投 Seq。** PostgreSQL 是唯一可信源，Seq 只是查看器。processor 先 insert 再 send，任一步抛错整个 job 按 `attempts: 3` 重试。重试意味着至少一次投递：落库靠 `orIgnore()` 吸收重复（同一雪花 ID 主键冲突被忽略），Seq 没有幂等机制，重试会出现重复事件。

**ID 在应用层用雪花算法生成，且必须在入队前生成。** 这样一条事件在重试中 ID 不变，`orIgnore()` 才有用。自增 ID 要等 insert 返回，重试前无法确定；UUID 可以提前生成，但不适合做 bigint 主键，随机分布也不利于索引局部性。雪花 ID 是 64 位、按时间递增的 bigint。

**不继承 BaseEntity、不软删除。** 日志不可变，`updatedAt` / `deletedAt` 没有意义；量大靠定时物理删除。

**用 AsyncLocalStorage 传上下文，不显式传参。** Node 内置，不引入 `cls-hooked` 之类的依赖；代价是非 HTTP 链路拿不到 store（见第 3 节）。

**内存缓冲 + 批量入队。** 每条日志都 `queue.add` 会让 Redis 往返数和日志条数一样多；攒批把它降到每 50 条或每 5 秒一次。`isFlushing` 保证同一时刻只有一个 flush 在跑，`onModuleDestroy` 时把剩余事件冲掉。

## 9. 已知限制

- 队列长时间不可用时缓冲区没有上限，事件一直堆在内存里；进程被 SIGKILL 也来不及在 `onModuleDestroy` 里 flush。这两种情况都会丢日志。
- Seq 侧无幂等，job 重试后会出现重复事件。
- `keyword` 用 ILIKE，走不了索引，全表扫，只用于管理员排查。
- 非 HTTP 链路（cron、队列、WebSocket）没有 requestId / userId。
- `generateSnowflakeId()` 在 `LoggerService.write()` 的 try/catch 之外，系统时钟回拨时它会抛错并传给调用方。
