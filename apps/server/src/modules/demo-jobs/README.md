# Demo Jobs

BullMQ 任务系统示例模块。

## 接口

### 异步导出

```http
POST /api/demo-jobs/export-report
{
  "title": "monthly-report",
  "steps": 5,
  "stepDelayMs": 500
}
```

随后轮询：

```http
GET /api/jobs/:id
```

### 失败重试

```http
POST /api/demo-jobs/flaky-retry
{
  "failTimes": 2
}
```

默认 `attempts = 3`，前 2 次失败，第 3 次成功。
