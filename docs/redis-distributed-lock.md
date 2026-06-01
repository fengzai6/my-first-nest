# Redis 分布式锁

> 用 Redis 实现分布式锁，解决缓存击穿和并发问题。

## 1. 为什么需要分布式锁

单机环境下可以用 JS 的 `Mutex` 或 `Semaphore`，但多实例部署时，每个进程的锁互不感知。

典型场景：

- **缓存击穿**：热点 Key 过期，100 个请求同时 miss，全部打到 DB
- **防止重复操作**：用户快速点击两次"提交订单"，创建了两笔
- **定时任务互斥**：多实例部署时，同一任务只执行一次

## 2. 最简实现：SET NX PX

Redis 的 `SET key value NX PX ttl` 是分布式锁的基础：

```
SET lock:my-resource <unique-value> NX PX 30000
```

- `NX`：只有 Key 不存在时才设置（获取锁）
- `PX 30000`：30 秒后自动释放（防死锁）
- `<unique-value>`：唯一标识（如 UUID），释放时验证身份

### 释放锁：必须用 Lua 脚本

```
-- 只有 value 匹配时才删除（防止误删别人的锁）
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
```

为什么不能用 `GET` + `DEL` 两步？因为两步之间可能有其他进程获取了锁，`DEL` 会误删。

## 3. 在项目中实现分布式锁

### 3.1 基于 CacheService 扩展

当前 `CacheService` 的 `set` 方法支持 TTL，但不支持 `NX` 选项。需要扩展。

```ts
// cache.service.ts 中新增方法
async setNx(key: string, value: string, ttlMs: number): Promise<boolean> {
  // 通过底层 Keyv store 拿到 Redis client
  // SET key value NX PX ttl
  const result = await this.redis.set(key, value, { NX: true, PX: ttlMs });
  return result === 'OK';
}
```

或者更干净的方式：新建一个 `LockService` 封装锁逻辑。

### 3.2 LockService 实现

```ts
@Injectable()
export class LockService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: RedisClientType) {}

  /**
   * 获取锁
   * @param key 锁的 Key
   * @param ttlMs 锁的自动过期时间（毫秒）
   * @returns 锁的唯一标识，释放时需要传回；获取失败返回 null
   */
  async acquire(key: string, ttlMs: number = 30_000): Promise<string | null> {
    const value = randomUUID();
    const result = await this.redis.set(key, value, { NX: true, PX: ttlMs });
    return result === 'OK' ? value : null;
  }

  /**
   * 释放锁
   * @param key 锁的 Key
   * @param token acquire 返回的唯一标识
   * @returns 是否释放成功
   */
  async release(key: string, token: string): Promise<boolean> {
    const lua = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(lua, {
      keys: [key],
      arguments: [token],
    });
    return result === 1;
  }
}
```

### 3.3 可重入锁（进阶）

上面的实现是不可重入的：同一线程再次获取同一把锁会失败。如果需要可重入：

```ts
// 用 Hash 记录重入次数
// Key:   lock:my-resource
// Field: <thread-id>
// Value: 重入次数

async acquireReentrant(key: string, ttlMs: number): Promise<string | null> {
  const threadId = randomUUID();
  const lua = `
    if redis.call("HEXISTS", KEYS[1], ARGV[1]) == 1 then
      redis.call("HINCRBY", KEYS[1], ARGV[1], 1)
      redis.call("PEXPIRE", KEYS[1], ARGV[2])
      return 1
    elseif redis.call("HLEN", KEYS[1]) == 0 then
      redis.call("HSET", KEYS[1], ARGV[1], 1)
      redis.call("PEXPIRE", KEYS[1], ARGV[2])
      return 1
    else
      return 0
    end
  `;
  const result = await this.redis.eval(lua, {
    keys: [key],
    arguments: [threadId, String(ttlMs)],
  });
  return result === 1 ? threadId : null;
}
```

大多数场景不需要可重入锁，保持简单即可。

## 4. 实际使用示例

### 4.1 解决缓存击穿（升级 wrap）

当前 `CacheService.wrap()` 的问题：并发请求同时 miss，全部执行 loader。

```ts
async findById(id: string) {
  const key = CacheKeys.USER_BY_ID(id);
  const lockKey = `lock:${key}`;

  // 1. 先查缓存
  const cached = await this.cache.get<User>(key);
  if (cached) return cached;

  // 2. 尝试获取锁
  const token = await this.lockService.acquire(lockKey, 5_000);

  if (token) {
    // 3. 拿到锁，执行 loader
    try {
      const user = await this.repo.findOneByOrFail({ id });
      await this.cache.set(key, user, 600);
      return user;
    } finally {
      // 4. 释放锁
      await this.lockService.release(lockKey, token);
    }
  } else {
    // 5. 没拿到锁，等一会儿再从缓存读
    await sleep(50); // 50ms
    const cached = await this.cache.get<User>(key);
    if (cached) return cached;
    // 还是没有，降级查 DB（兜底）
    return this.repo.findOneByOrFail({ id });
  }
}
```

### 4.2 防止重复提交

```ts
@Controller('orders')
export class OrdersController {
  @Post()
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: User) {
    const lockKey = `lock:order:create:${user.id}`;
    const token = await this.lockService.acquire(lockKey, 10_000);

    if (!token) {
      throw new ConflictException('请勿重复提交');
    }

    try {
      return await this.orderService.create(dto, user);
    } finally {
      await this.lockService.release(lockKey, token);
    }
  }
}
```

### 4.3 定时任务互斥

```ts
@Injectable()
export class TaskService {
  @Cron('*/5 * * * *') // 每 5 分钟
  async syncData() {
    const lockKey = 'lock:cron:sync-data';
    const token = await this.lockService.acquire(lockKey, 240_000); // 4 分钟过期

    if (!token) return; // 其他实例在执行，跳过

    try {
      await this.doSync();
    } finally {
      await this.lockService.release(lockKey, token);
    }
  }
}
```

## 5. Redlock 算法（进阶）

单 Redis 实例的锁有一个风险：主节点挂了，锁丢失。

Redlock 是 Redis 作者提出的分布式锁算法：

1. 向 N 个独立 Redis 节点（推荐 5 个）请求锁
2. 多数（N/2 + 1）节点获取成功才算拿到锁
3. 锁的有效时间 = TTL - 获取锁耗时
4. 释放时向所有节点释放

```ts
// 使用 redlock 库
import Redlock from 'redlock';

const redlock = new Redlock([redisClient], {
  retryCount: 3,
  retryDelay: 200,
});

async function withLock<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const lock = await redlock.acquire([`lock:${key}`], ttl);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
```

**什么时候需要 Redlock**：单 Redis 实例够用的场景不需要。只有对锁的可靠性要求极高（金融、库存扣减）才考虑。

## 6. 使用建议

| 要点 | 说明 |
| --- | --- |
| 锁的粒度 | Key 要细，`lock:user:123` 而不是 `lock:users` |
| TTL 要合理 | 太短任务没执行完锁就没了，太长失败后等待久 |
| 必须 finally 释放 | 防止异常导致死锁 |
| 唯一标识 | 用 UUID 做 value，释放时验证身份 |
| 等待策略 | 没拿到锁时 sleep 50-100ms 再重试，不要 tight loop |

## 7. 已知限制

- 当前项目 `CacheService` 没有暴露 `SET NX` 接口，需要扩展或新建 `LockService`。
- `node-redis` 的 `eval` 方法签名可能因版本不同略有差异，实现时以实际 API 为准。
- 如果 Redis 不可用，锁机制也随之失效。对可靠性要求极高的场景需要考虑数据库行锁兜底。
