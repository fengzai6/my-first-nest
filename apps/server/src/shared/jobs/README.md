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
- `POST /api/jobs/:id/cancel` 取消 queued/delayed

## 与 @nestjs/schedule 的边界

| | scheduled-tasks | shared/jobs |
|--|---------------|-------------|
| 定位 | 轻量进程内 cron | 完整任务系统 |
| 进度/结果 | 无 | `job_runs` |
| 重试 | 需自管 | BullMQ attempts |
| 多实例 | 可能重复执行 | 队列消费 |

## Redis

任务系统依赖 Redis。未配置 `REDIS_URL` / `REDIS_HOST` 时，Jobs 模块初始化会失败。
BullMQ 使用独立 ioredis 连接，队列前缀为 `${REDIS_KEY_PREFIX}bull`。
