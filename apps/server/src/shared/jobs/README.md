# Jobs 任务基础设施

> 基于 BullMQ + PostgreSQL 的统一任务底座。

## 能力

- 接口触发的异步任务
- 延迟任务
- 失败重试
- 进度更新
- 执行记录落库与查询

## 业务接入

1. 实现 `IJobHandler`
2. 在构造函数中 `registry.register(this)`
3. 把 handler 放进业务模块 `providers`
4. 调用 `jobService.submit({ name, payload })`

```ts
@Injectable()
export class CleanupHandler implements IJobHandler {
  readonly name = 'cleanup-temp';

  constructor(registry: JobRegistryService) {
    registry.register(this);
  }

  async handle(ctx: IJobContext) {
    // business logic
  }
}
```

## API

- `GET /api/jobs` 任务列表
- `GET /api/jobs/:id` 单任务轮询
- `GET /api/jobs/:id/events` 单任务 SSE 事件流
- `POST /api/jobs/:id/cancel` 取消 queued/delayed

## 附件物理清理

- 每天 03:00 自动提交 `cleanup-attachments`
- 手动接口：`POST /api/background-tasks/cleanup-attachments`
- 候选：超过保留期的软删除附件、从未绑定的孤儿附件
- 结果：`deletedMetadataCount`、`missingFileCount`、`failedCount`、`scannedCount`、`reachedSafetyLimit`

## SSE 事件流

`GET /api/jobs/:id/events` 是轮询之外的第二种学习示例，本期先提供服务端能力，前端暂不接入。

- 连接后先发送 `job.snapshot`
- 状态或进度变化发送 `job.updated`
- `completed` / `failed` / `cancelled` 会发送终态事件并结束流
- 需要 JWT，与其它 Jobs API 一样不对外裸奔

事件格式：

```text
event: job.updated
id: 1
data: {"id":"...","status":"active","progress":50}

```

## 任务中心 vs Bull Board

| 视图         | 数据源                | 用途                                                          |
| ------------ | --------------------- | ------------------------------------------------------------- |
| 前端任务中心 | PostgreSQL `job_runs` | 展示业务任务生命周期、payload、result、errorMessage、触发类型 |
| Bull Board   | BullMQ queue          | 观察队列内部 waiting/active/completed/failed 状态             |

Bull Board 挂载在 `/admin/queues`，用于队列可观测性学习，不能替代业务任务中心。

## 轮询 vs SSE

| 方式 | 优点               | 缺点             | 适用     |
| ---- | ------------------ | ---------------- | -------- |
| 轮询 | 实现简单、兼容性好 | 有延迟、多余请求 | 通用默认 |
| SSE  | 实时、服务端推送   | 连接管理更复杂   | 进度场景 |

前端任务中心本期使用 `GET /api/jobs/:id` 轮询。SSE 后端接口保留，可用 curl 单独验证：

```bash
curl -N \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer <access-token>" \
  http://localhost:3174/api/jobs/<job-id>/events
```

## 与 @nestjs/schedule 的边界

|           | scheduled-tasks | shared/jobs     |
| --------- | --------------- | --------------- |
| 定位      | 轻量进程内 cron | 完整任务系统    |
| 进度/结果 | 无              | `job_runs`      |
| 重试      | 需自管          | BullMQ attempts |
| 多实例    | 可能重复执行    | 队列消费        |

## Redis

任务系统依赖 Redis。未配置 `REDIS_URL` / `REDIS_HOST` 时，Jobs 模块初始化会失败。
BullMQ 使用独立 ioredis 连接，队列前缀为 `${REDIS_KEY_PREFIX}bull`。
