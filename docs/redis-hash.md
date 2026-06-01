# Redis Hash 结构

> 用 Hash 存储对象，支持字段级读写，比 String JSON 更灵活。

## 1. String vs Hash

当前项目用 String 类型存对象（通过 Keyv 自动 JSON 序列化）。这有个问题：

```
Key:   users:123
Value: '{"id":"123","username":"nacho","email":"x@y.com","avatar":"...","bio":"..."}'
```

每次读 `username`，要把整个 JSON 反序列化出来。如果只想更新 `avatar`，也要先读整个对象、改字段、再写回去。

Hash 把对象拆成字段存储：

```
Key:      users:123
Fields:   id → "123"
          username → "nacho"
          email → "x@y.com"
          avatar → "https://..."
          bio → "..."
```

优势：

- **按字段读取**：`HGET users:123 username` 只拿一个字段，不读整个对象
- **按字段更新**：`HSET users:123 avatar "new-url"` 只改一个字段，不覆盖其他
- **内存更省**：Hash 在字段少于 128 个时用 ziplist 编码，比 JSON 字符串紧凑

## 2. 核心命令

```bash
# 写入单个字段
HSET user:123 username "nacho" email "x@y.com"

# 读取单个字段
HGET user:123 username          # → "nacho"

# 读取多个字段
HMGET user:123 username email   # → ["nacho", "x@y.com"]

# 读取所有字段和值
HGETALL user:123                # → { username: "nacho", email: "x@y.com", ... }

# 判断字段是否存在
HEXISTS user:123 avatar         # → 0 (不存在)

# 删除字段
HDEL user:123 bio

# 获取字段数量
HLEN user:123                   # → 2

# 字段自增（计数器场景）
HINCRBY user:123 login_count 1
```

## 3. 在 CacheService 中扩展 Hash 支持

当前 `CacheService` 基于 Keyv，只支持 String 类型的 get/set。要支持 Hash，需要扩展。

### 3.1 方案选择

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| A. 继续用 Keyv，把 Hash 序列化为 String | 不改底层，简单 | 失去字段级读写能力 |
| B. 在 CacheService 中注入 Redis 原生 client | 完整 Hash 能力 | 绕过了 Keyv 抽象 |
| C. 新增一个 `HashCacheService` 独立封装 | 职责清晰，不污染现有 CacheService | 多一个服务 |

**推荐方案 C**：新增 `HashCacheService`，职责清晰，和现有 CacheService 互不影响。

### 3.2 获取 Redis 原生 client

当前 `@keyv/redis` 底层使用 `node-redis`。获取原生 client 的方式：

```ts
// cache.module.ts 中，KeyvRedis 实例内部有 .client 属性
const keyvRedis = new KeyvRedis(url);
const redisClient = keyvRedis.client;  // node-redis 的 RedisClientType
```

需要在 `RedisCacheModule` 中把 `redisClient` 注册为 provider，供 `HashCacheService` 注入。

### 3.3 HashCacheService 实现

```ts
@Injectable()
export class HashCacheService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: RedisClientType) {}

  /** 设置单个字段 */
  async hset(key: string, field: string, value: string | number): Promise<void> {
    await this.redis.hSet(key, field, String(value));
  }

  /** 读取单个字段 */
  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hGet(key, field);
  }

  /** 读取多个字段 */
  async hmget(key: string, fields: string[]): Promise<(string | null)[]> {
    return this.redis.hmGet(key, fields);
  }

  /** 读取整个 Hash */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hGetAll(key);
  }

  /** 删除字段 */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.redis.hDel(key, fields);
  }

  /** 字段自增 */
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return this.redis.hIncrBy(key, field, increment);
  }

  /** 设置整个 Hash 的 TTL */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(key, ttlSeconds);
  }
}
```

### 3.4 注册到 Module

```ts
// cache.module.ts
@Global()
@Module({
  imports: [/* ...existing */],
  providers: [
    CacheService,
    CacheHealthIndicator,
    HashCacheService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        // 从 KeyvRedis 实例中提取原生 client
        // 具体实现取决于如何持有 keyvRedis 引用
      },
    },
  ],
  exports: [CacheService, CacheHealthIndicator, HashCacheService],
})
export class RedisCacheModule {}
```

## 4. 实际使用示例

### 4.1 用户信息缓存（字段级读写）

```ts
@Injectable()
export class UsersService {
  constructor(
    private readonly hashCache: HashCacheService,
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const key = `users:${id}`;

    // 先尝试从 Hash 读
    const cached = await this.hashCache.hgetall(key);
    if (Object.keys(cached).length > 0) {
      return plainToInstance(User, cached);
    }

    // 未命中，查 DB 并写入 Hash
    const user = await this.repo.findOneByOrFail({ id });
    const fields = instanceToPlain(user);
    for (const [field, value] of Object.entries(fields)) {
      await this.hashCache.hset(key, field, value as string);
    }
    await this.hashCache.expire(key, 600); // 10 分钟过期
    return user;
  }

  /** 只更新头像，不影响其他字段 */
  async updateAvatar(id: string, avatarUrl: string) {
    await this.repo.update(id, { avatar: avatarUrl });
    // 只更新 Hash 中的 avatar 字段
    await this.hashCache.hset(`users:${id}`, 'avatar', avatarUrl);
  }
}
```

### 4.2 接口调用计数器

```ts
@Injectable()
export class ApiMetricsService {
  constructor(private readonly hashCache: HashCacheService) {}

  /** 记录一次 API 调用 */
  async recordCall(endpoint: string, userId: string) {
    const key = `metrics:${endpoint}:${new Date().toISOString().slice(0, 10)}`;
    await this.hashCache.hincrby(key, userId, 1);
    await this.hashCache.expire(key, 86400 * 7); // 保留 7 天
  }

  /** 查看某接口今天的调用统计 */
  async getDailyStats(endpoint: string): Promise<Record<string, string>> {
    const key = `metrics:${endpoint}:${new Date().toISOString().slice(0, 10)}`;
    return this.hashCache.hgetall(key);
  }
}
```

### 4.3 用户在线状态

```ts
// 用户上线
await hashCache.hset('online:users', userId, Date.now().toString());

// 用户下线
await hashCache.hdel('online:users', userId);

// 查看所有在线用户
const online = await hashCache.hgetall('online:users');
```

## 5. Hash vs String 选择指南

| 场景 | 推荐 | 理由 |
| --- | --- | --- |
| 整体读写、很少改单个字段 | String | 更简单，Keyv 直接支持 |
| 频繁读写单个字段 | Hash | 避免读写整个对象 |
| 对象字段很多（>100） | String | Hash 字段太多性能下降 |
| 需要计数器 | Hash | `HINCRBY` 原子操作 |
| 对象很小（几个字段） | 都行 | 差别不大，选简单的 |

## 6. 注意事项

- **TTL 是整个 Key 的**：Hash 不能给单个字段设 TTL，只能给整个 Key 设。如果需要字段级过期，要用 String 分开存。
- **HGETALL 要慎用**：字段很多时 `HGETALL` 会返回大量数据，考虑用 `HMGET` 只取需要的字段。
- **序列化**：Redis Hash 的 field 和 value 都是字符串，存数字/对象需要自行转换。
