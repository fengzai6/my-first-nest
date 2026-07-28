# Scheduled Tasks

基于 `@nestjs/schedule` 的轻量定时任务。

## 行为

- 每分钟输出一条 heartbeat 日志
- 不进入 BullMQ
- 不写入 `job_runs`

## 对比

| | scheduled-tasks | BullMQ jobs |
|--|---------------|-------------|
| 接入成本 | 很低 | 中等 |
| 多实例 | 易重复执行 | 队列天然单次消费 |
| 进度/历史 | 无 | PostgreSQL `job_runs` |
| 适用 | 简单本地周期逻辑 | 异步任务 / 重试 / 任务中心 |

## 业务定时任务

- 每天 01:00 入队 `cleanup-expired-refresh-tokens`
- 通过 `JobService.submit` 写入 `job_runs`，执行走 BullMQ Worker

