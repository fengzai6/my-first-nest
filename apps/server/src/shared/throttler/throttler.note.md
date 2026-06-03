# Throttler

## 作用

当前项目的接口限流基于 `@nestjs/throttler` 实现，并接入了全局 `APP_GUARD`。

整体职责分为三层：

- `throttler.module.ts`
  负责注册 `ThrottlerModule`，读取全局默认限流配置。
- `throttler.guard.ts`
  负责决定当前请求按谁限流。
- `redis-throttler-storage.ts`
  负责把限流计数落到 Redis。

## 当前策略

### 1. 全局默认限流

默认配置来自 `config.default.ts` 中的 `throttler`：

- `ttl`: `60000`
- `limit`: `60`

表示默认情况下：

- 同一个 tracker 在 60 秒内最多允许 60 次请求
- 第 61 次开始返回 `429 Too Many Requests`

### 2. tracker 选择

`AppThrottlerGuard` 的 tracker 规则：

- 能拿到当前登录用户时，使用 `user:${userId}`
- 否则使用 `ip:${req.ip}`

这样登录用户和匿名用户的限流粒度不同：

- 已登录接口更偏向按用户限流
- 公开接口更偏向按 IP 限流

`useRequestUser()` 依赖请求上下文拦截器，Guard 阶段不一定总能取到，所以当前实现会回退到 `req.user`。

### 3. auth 接口的单独限流

`AuthController` 上显式覆盖了默认限流：

- `POST /auth/signup`: 1 小时 3 次
- `POST /auth/login`: 60 秒 5 次
- `POST /auth/refresh-token`: 60 秒 10 次
- `POST /auth/logout`: 60 秒 10 次

对应常量在 `common/constants/auth.ts` 中维护。

## Redis 存储

### 1. Key 结构

当前限流 Redis key 结构：

- 计数 key: `throttle:${throttlerName}:${key}`
- 阻塞 key: `throttle:block:${throttlerName}:${key}`

其中：

- `throttlerName` 当前默认是 `default`
- `key` 是 `@nestjs/throttler` 生成的哈希值

### 2. 计数方式

当前实现使用固定窗口：

1. 先检查 block key 是否存在
2. 存在则直接判定为已限流
3. 不存在则执行 `INCR`
4. 首次命中时设置 `PEXPIRE`
5. 超过 limit 后写入 block key

### 3. 退化行为

- 未配置 Redis：缓存模块使用内存 store，应用正常启动
- 已配置 Redis 但连不上：应用启动直接失败
- Redis 限流命令在运行期异常：当前限流逻辑降级为“不限流”

最后一条是当前实现的明确取舍，不是遗漏。

## 启动链路

`AppModule` 中：

- 导入 `ThrottlerConfigModule`
- 注册 `AppThrottlerGuard` 为全局 `APP_GUARD`

只有这两步同时存在，限流才真正生效：

- 只有 module 没有 guard：不会执行限流
- 只有 guard 没有 module：guard 无法拿到 throttler 配置和 storage

## 实际执行链

请求命中带限流的接口时，执行关系如下：

```txt
ThrottlerConfigModule
  ↓ 提供全局 throttler 配置和 RedisThrottlerStorage
@Throttle(...)
  ↓ 给具体方法写入 limit / ttl metadata
AppThrottlerGuard
  ↓ 读取 @Throttle metadata
RedisThrottlerStorage.increment(...)
  ↓ 用 Redis 计数
超限则抛 429
```

如果某个接口没有显式写 `@Throttle(...)`，那么 `AppThrottlerGuard` 会回退到 `ThrottlerConfigModule` 中注册的全局默认配置。

## 已验证结果

本地已验证：

- `GET /api`：60 次内返回 `200`，第 61 次返回 `429`
- `POST /api/auth/login`：前 5 次为业务校验错误，第 6 次返回 `429`

说明：

- 全局默认限流已生效
- auth 接口自定义限流已生效
