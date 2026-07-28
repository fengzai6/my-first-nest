# Background Tasks

基于 BullMQ 的后台任务模块。

## 接口

### 异步导出

```http
POST /api/background-tasks/export-report
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
POST /api/background-tasks/flaky-retry
{
  "failTimes": 2
}
```

默认 `attempts = 3`，前 2 次失败，第 3 次成功。

### 清理过期 refresh token

```http
POST /api/background-tasks/cleanup-expired-refresh-tokens
```

随后轮询：

```http
GET /api/jobs/:id
```

