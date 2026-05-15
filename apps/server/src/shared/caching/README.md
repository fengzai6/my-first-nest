# Redis 缓存

> 这个目录是项目级缓存基础设施。当前实现：[@nestjs/cache-manager](https://docs.nestjs.com/techniques/caching) + [Keyv](https://keyv.org/) + [@keyv/redis](https://github.com/jaredwray/keyv/tree/main/packages/redis)。
> 业务模块只需要注入 `CacheService`，不直接接触底层 Redis 客户端。

## 1. 为什么需要缓存

数据库是项目里最常见的"慢"。一次普通查询动辄几十毫秒，复杂联表 / 聚合可能到几百毫秒；同样的查询如果每秒被打几千次，数据库的 CPU 和 IO 都会被压垮。

**缓存的核心思路**：把最近查过、不太变的数据存到一个比 DB 更快的地方，下次同样的请求直接从那里拿，不去打数据库。

适合缓存的典型场景：

- 用户基础信息（一天不一定变一次）
- 商品列表 / 配置项 / 字典数据
- 接口聚合结果（多个查询拼出来的复合数据）
- 鉴权信息（token → userId 映射，本项目 RefreshToken 就是这么做的）

## 2. 为什么选 Redis

"放到一个更快的地方"最简单是放进程内存（一个全局 `Map`）。但进程内存有几个限制：

- 应用一重启，缓存全没；
- 多实例部署时每个实例各管各的，数据不一致；
- 内存上限受应用进程约束，淘汰策略只能很简陋。

Redis 是一个独立的、放在内存里跑的键值数据库，解决了上面所有问题：

- 数据可以持久化（AOF/RDB），重启不丢；
- 多个应用实例共享同一份缓存；
- 内置丰富的数据结构（String / Hash / List / Set / ZSet / Stream）；
- 自带过期、淘汰策略、Pub/Sub、Lua 脚本、原子操作。

代价是：多一次网络往返（局域网通常 0.5-2ms）。和读 DB 的几十毫秒相比，依然非常划算。

## 3. 几个必须知道的概念

### 3.1 Key 和 Value

Redis 本质是一个键值（KV）数据库。Key 是字符串；Value 可以是字符串、对象（实际还是字符串）、列表等。

### 3.2 TTL（Time To Live，过期时间）

每个 Key 都可以带"活多久"，到期 Redis 自动删除。这是缓存最重要的特性 —— **不需要应用手动清理过期数据**。

```bash
SET user:123 "{...}" EX 600   # 10 分钟后这个 Key 会自动消失
```

设置 TTL 的取舍：

- 太短 → 缓存命中率低，等于没缓存；
- 太长 → 数据更新后用户看到旧值的时间过长；
- 经验值：用户/商品/配置类 5-30 分钟；高频读但又会变的（订单状态）30 秒 - 2 分钟。

### 3.3 命名空间（Namespace / Key Prefix）

多个项目共用一个 Redis 实例时，必须用前缀隔离：

```
my-first-nest::users:123     # 项目 A
ecommerce::users:123          # 项目 B
```

否则 Key 撞了就互相覆盖。本项目用环境变量 `REDIS_KEY_PREFIX` 配置，默认 `my-first-nest:`。最终落地 Key 形如 `my-first-nest::users:123`（Keyv 用 `::` 拼接 namespace 与 key）。

### 3.4 序列化（Serialization）

Redis Value 本质是字节，但应用层经常需要存对象。所以存对象时必须先 `JSON.stringify`，读出来时 `JSON.parse`。

`@nestjs/cache-manager` + Keyv 已经帮我们做了这一步，业务层直接 `set(key, obj)` 即可。**注意**：对象里含有 `Date`、`Map`、`Set`、循环引用等时 JSON 序列化会丢精度甚至报错，缓存对象时尽量是 POJO（plain old object）。

### 3.5 Cache-Aside（旁路缓存）

最常用的缓存模式，伪代码：

```
读：
  1. 先查缓存
  2. 命中 → 返回
  3. 未命中 → 查 DB → 写缓存 → 返回

写：
  1. 写 DB
  2. 删缓存（不是更新缓存）
```

**为什么是"删"而不是"更新"**：并发场景下"更新缓存"可能因为竞态写入旧值；"删除缓存"让下一次读时重新载入，更稳。

其他模式作为延伸了解：

- **Write-Through**：写时同步更新缓存 + DB。
- **Write-Behind**：写时只更新缓存，异步刷 DB。
- **Read-Through**：读 miss 时缓存自己去 DB 拿（业务无感）。本项目的 `wrap()` 接近这个语义。

### 3.6 缓存三大经典问题

#### 3.6.1 缓存穿透

查询一个**根本不存在**的数据（例如 `user_id=99999`），每次都打到 DB，缓存形同虚设。攻击者可以借此打垮 DB。

**解法**：

- 给"不存在"也缓存（短 TTL，比如 60 秒）；
- 用布隆过滤器（Bloom Filter）提前过滤明显不存在的 Key。

#### 3.6.2 缓存击穿

某个**热点 Key 突然过期**，瞬间大量请求穿透到 DB。

**解法**：

- 加分布式锁，让第一个请求去回源，其他请求等结果；
- 热点 Key 设置永不过期，后台异步更新。

#### 3.6.3 缓存雪崩

**大量 Key 同时过期**（比如一次性预热的缓存），瞬时 DB 压力暴涨。

**解法**：

- TTL 加随机抖动（比如 600s ± 60s）；
- 多级缓存（本地内存 + Redis）。

### 3.7 缓存惊群（Thundering Herd / Cache Stampede）

缓存未命中时，**并发多个相同请求**同时去回源，DB 被打多次。

**解法**：和缓存击穿类似 —— 分布式锁或单飞（singleflight）。

> ⚠️ 本项目 `wrap()` 暂未做单飞，是已知风险，后续接入分布式锁解决。生产敏感场景请用显式 get + 锁。

## 4. 项目里的实现

### 4.1 目录结构

```
apps/server/src/shared/caching/
├── README.md            # 本文档（项目里的单一来源）
├── cache.module.ts      # @Global RedisCacheModule，注册到 AppModule
├── cache.service.ts     # 统一封装的 CacheService（业务模块只接触它）
├── cache.constants.ts   # 集中维护的 Key 命名工厂 CacheKeys
└── cache.health.ts      # 健康检查 CacheHealthIndicator
```

设计原则：

- **业务模块只依赖 `CacheService`**，不直接接触 cache-manager / Keyv / 底层 Redis 客户端。
- 切换底层（比如以后换成 Memcached）只需要改 `CacheModule`，业务无感。

### 4.2 CacheService 的方法一览

```ts
class CacheService {
  isRedisEnabled(): boolean;                                   // 当前底层是否是 Redis（业务做双模式分支用）
  get<T>(key): Promise<T | undefined>;                          // 读
  set<T>(key, value, ttlSeconds?): Promise<T>;                  // 写（TTL 单位：秒）
  del(key: string | string[]): Promise<boolean>;                // 删
  wrap<T>(key, loader, ttlSeconds?): Promise<T>;                // 命中返回，未命中执行 loader 并写入
  invalidatePattern(pattern: string): Promise<number>;          // 按 SCAN 模式批量失效（仅 Redis 支持）
}
```

> ⚠️ `set`/`wrap` 的 TTL 参数单位是**秒**；下面 `@CacheTTL` 装饰器单位是**毫秒**。两边不一致，请注意。

### 4.3 显式读写：Cache-Aside 完整示例

```ts
@Injectable()
export class UsersService {
  constructor(
    private readonly cache: CacheService,
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async findById(id: string) {
    const key = CacheKeys.USER_BY_ID(id);

    // 1. 先查缓存
    const cached = await this.cache.get<User>(key);
    if (cached) return cached;

    // 2. 未命中 → 查 DB
    const user = await this.repo.findOneByOrFail({ id });

    // 3. 写缓存（10 分钟 TTL）
    await this.cache.set(key, user, 600);

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.repo.update(id, dto);
    // 写操作必须删缓存，否则下次读会拿到旧数据
    await this.cache.del(CacheKeys.USER_BY_ID(id));
    return user;
  }
}
```

### 4.4 wrap 简化版

`wrap` 把"先查缓存，未命中回源"封装好了：

```ts
async findById(id: string) {
  return this.cache.wrap(
    CacheKeys.USER_BY_ID(id),
    () => this.repo.findOneByOrFail({ id }),  // loader：未命中时执行
    600,                                        // TTL
  );
}
```

效果等同 4.3 的三步骤，代码更紧凑。**适用范围**：纯读、loader 是幂等的、并发量没到惊群级别。

### 4.5 装饰器风格（CacheInterceptor）

适合**幂等 GET 接口**的整体响应缓存：

```ts
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@UseInterceptors(CacheInterceptor)
@Controller('cats')
export class CatsController {
  @Get('list')
  @CacheKey('cats:list')      // 显式 Key（不写则根据 URL 自动生成）
  @CacheTTL(60_000)            // ⚠️ 装饰器的 TTL 单位是毫秒
  list() {
    return this.catsService.list();
  }
}
```

什么时候**不要**用 `CacheInterceptor`：

- 带分页 / 排序 / 查询参数 → Key 推断容易撞；
- 与登录态相关（不同用户看到的内容应该不同）—— 除非自定义 trackBy；
- 更新后需要立即失效的接口（拦截器无法主动失效，必须等 TTL 到期或手动 `del`）。

### 4.6 Key 命名规范

所有业务 Key 都通过 [`cache.constants.ts`](https://github.com/fengzai6/my-first-nest/blob/main/apps/server/src/shared/caching/cache.constants.ts) 的 `CacheKeys` 工厂生成：

```ts
export const CacheKeys = {
  USER_BY_ID: (id) => `users:${id}`,
  AUTH_REFRESH_TOKEN: (token) => `auth:refresh:${token}`,
  // ...
} as const;
```

**不要在调用处用字符串拼接 Key**；新业务域优先扩展 `CacheKeys`。

## 5. 配置

### 5.1 环境变量一览

完整配置见 [`apps/server/.env.example`](https://github.com/fengzai6/my-first-nest/blob/main/apps/server/.env.example) 的 Redis 段。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `REDIS_URL` | - | `redis://[:password@]host:port[/db]`；与 `REDIS_HOST` 二选一 |
| `REDIS_HOST` | - | 主机；与 URL 二选一 |
| `REDIS_PORT` | `6379` | 端口 |
| `REDIS_PASSWORD` | - | 密码 |
| `REDIS_DB` | `0` | DB 索引 (0-15) |
| `REDIS_DEFAULT_TTL` | `300` | 默认 TTL（秒），0 = 不过期 |
| `REDIS_KEY_PREFIX` | `my-first-nest:` | Key 前缀（Keyv 命名空间） |
| `REDIS_REQUIRED` | `false` | true 时连接失败将阻塞启动 |

**不配置任何 Redis 变量时**：自动降级为进程内内存 store，应用正常启动。适合本地开发或单机测试。

### 5.2 启动期的连接验证

`RedisCacheModule.onApplicationBootstrap()` 会做一次 1 秒超时的 PING：

- 成功 → 日志 `Redis 连接正常 (prefix=...)`；
- 失败 + `REDIS_REQUIRED=false` → 日志 warning，继续运行；
- 失败 + `REDIS_REQUIRED=true` → 抛 `Redis is required but not reachable`，启动终止。

## 6. 启动 Redis

### 6.1 Docker（推荐）

```bash
# 项目根目录执行
docker-compose -f docker/docker-compose.cache.yml up -d

# 在 apps/server/.env 中加
REDIS_URL=redis://localhost:6379
```

### 6.2 本地原生安装

```bash
# macOS
brew install redis && brew services start redis

# Ubuntu/Debian
sudo apt install redis-server && sudo systemctl start redis
```

### 6.3 验证

```bash
redis-cli ping
# 应该输出 PONG

# 启动应用后，登录一次，看看 Key 有没有写进去
redis-cli --scan --pattern 'my-first-nest:*'
```

## 7. 双模式案例：RefreshToken

`RefreshToken` 是本项目第一个 "Redis 可选" 模式的实战案例：

- 配了 Redis → token 存 Redis，TTL 自动清理；
- 没配 Redis → 落回原来的 `users_refresh_tokens` 表。

[`refresh-token.service.ts`](https://github.com/fengzai6/my-first-nest/blob/main/apps/server/src/modules/auth/refresh-token.service.ts) 关键写法：

```ts
async create(user: User) {
  const tokens = this.generateTokens(user);

  // 分支：Redis 走 Redis，否则走 DB
  if (this.cacheService.isRedisEnabled()) {
    await this.cacheService.set(
      CacheKeys.AUTH_REFRESH_TOKEN(tokens.refreshToken),
      user.id,
      jwt.refreshExpiresIn,
    );
    return tokens;
  }

  // DB 兜底
  await this.refreshTokenRepository.save({
    token: tokens.refreshToken,
    expiresAt: tokens.refreshExpiresAt,
    user,
  });
  return tokens;
}
```

为什么这么设计：

- 学习阶段本地不一定有 Redis，DB 兜底让项目开箱即用。
- 部署生产时配上 Redis，token 自动按 TTL 清理，省一张表。
- 切换无感：业务调用方不需要改任何东西。

⚠️ **切换模式不会迁移历史数据**：DB 模式 → Redis 模式 之间切换时，旧模式下的 token 全部失效，用户需要重新登录。

> 这种"双模式 + isRedisEnabled() 分支"的写法可以复用到 session、限流、黑名单等场景。

## 8. 何时不要用缓存

- **写多读少的数据**：缓存命中率低，反而多一层失效成本。
- **强一致性要求**：金额、库存等不能容忍"看到旧值"的字段，要么不缓存，要么走分布式事务。
- **数据本身就在内存里**：DB 已经 sub-ms 响应了，加缓存只是引入复杂度。
- **太大的对象**（>256KB）：建议拆分或不缓存，否则单 Key 占用大量内存。
- **敏感数据**：除非加密，Redis 数据是明文存的，运维都能看；银行卡、密码等绝对不要进缓存。

## 9. Redis 进阶知识（选读）

### 9.1 持久化：AOF 与 RDB

- **RDB**（Redis Database）：定时快照，整个内存 dump 成一个文件。恢复快，但崩溃可能丢最后一次快照之后的数据。
- **AOF**（Append-Only File）：每个写操作追加到日志文件。可配置 fsync 频率（always / everysec / no），恢复慢但更安全。

项目内 Docker 配置开启了 AOF（`--appendonly yes`），见 [docker-compose.cache.yml](https://github.com/fengzai6/my-first-nest/blob/main/docker/docker-compose.cache.yml)。

### 9.2 内存淘汰策略（maxmemory-policy）

Redis 内存满了之后怎么办：

- `noeviction`（默认）：直接报错拒绝写入；
- `allkeys-lru`：所有 Key 里淘汰最近最少使用的（推荐做缓存时用）；
- `allkeys-lfu`：所有 Key 里淘汰最少使用频次的；
- `volatile-lru`：只在带 TTL 的 Key 里淘汰；
- `allkeys-random` / `volatile-random` / `volatile-ttl`：其他策略。

**做缓存推荐 `allkeys-lru`**，做持久化数据用 `noeviction`。

### 9.3 常用数据结构与命令

| 类型 | 典型场景 | 关键命令 |
| --- | --- | --- |
| String | 普通 KV、计数器 | `GET` / `SET` / `INCR` |
| Hash | 对象字段级读写 | `HGET` / `HSET` / `HGETALL` |
| List | 队列、消息流 | `LPUSH` / `RPOP` / `LRANGE` |
| Set | 去重集合、标签 | `SADD` / `SISMEMBER` / `SINTER` |
| Sorted Set | 排行榜、延时队列 | `ZADD` / `ZRANGE` / `ZRANGEBYSCORE` |
| Stream | 消息队列（带消费组） | `XADD` / `XREAD` / `XGROUP` |

本项目当前只用到 String（通过 Keyv 抽象）。

### 9.4 原子性与事务

Redis 单线程模型：每条命令都是原子的；多条命令之间可以用 `MULTI/EXEC` 组成事务，或者用 Lua 脚本一次提交。这是实现"分布式锁"、"原子计数器" 的基础。

### 9.5 Pipeline（管道）

把多条命令打包一次发送，减少 RTT。批量操作时用得上。`@keyv/redis` 底层是 node-redis，原生支持 pipeline，但当前 `CacheService` 没暴露这层接口；需要时可以从 `KeyvRedis.client` 拿到原始 client 调用。

### 9.6 Cluster / Sentinel

- **Cluster**：多个 Redis 节点用一致性哈希分片，扩容靠加节点。
- **Sentinel**：主从复制 + 故障转移，主挂了 sentinel 自动选新主。

本项目当前只接单实例。`@keyv/redis` 支持这两种部署形态，需要时改连接参数即可。

## 10. 后续规划（不在本期）

- session 管理：完全迁移登录态到 Redis；
- 接口限流：基于 Redis 的滑动窗口 / 令牌桶；
- 分布式锁：解决缓存惊群，配合 `wrap()` 升级；
- WebSocket 多实例广播：`@socket.io/redis-adapter`；
- 领域事件总线：Pub/Sub 雏形。

## 延伸阅读

- [NestJS 缓存](https://docs.nestjs.com/techniques/caching)
- [Redis 官方文档](https://redis.io/docs/)
- [Keyv 文档](https://keyv.org/)
- [Redis Best Practices（Redis Labs）](https://redis.io/learn/howtos/solutions)
- [面试常考的缓存三大问题](https://github.com/CyC2018/CS-Notes/blob/master/notes/缓存.md)
