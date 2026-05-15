# Redis 缓存集成方案

> 状态：草案待评审
> 范围：仅基础设施（RedisModule + CacheService + 配置 + 健康检查 + Docker）
> 目标版本：apps/server v0.x

## 一、目标与非目标

### 目标

1. 引入 Redis 作为应用级缓存基础设施。
2. 在 NestJS 中提供统一、类型安全的缓存读写入口（`CacheService`）。
3. 支持声明式缓存（`@CacheKey` / `@CacheTTL` + `CacheInterceptor`）以便后续模块按需接入。
4. 通过环境变量驱动连接配置，遵循项目现有的 `config` 体系（`config.default.ts` + Joi 校验 + `configuration.interface.ts`）。
5. 提供启动期连接探测 + 运行期健康检查。
6. 提供本地与生产的 Docker 编排。

### 非目标（本期不做）

- 不修改 `users` / `auth` / `roles` / `permissions` 等业务模块的现有逻辑。
- 不做 Session 管理、RefreshToken 迁移至 Redis、限流、分布式锁、Pub/Sub。
- 不引入 Redis Cluster / Sentinel 客户端封装（保留扩展位）。
- 不替换 React Query 的客户端缓存。

> 上述非目标会作为后续 issue 单独跟进（与路线图中的 "session 管理"、"接口限流" 等条目对齐）。

---

## 二、选型与依据

| 选项 | 结论 |
| --- | --- |
| 缓存抽象 | `@nestjs/cache-manager`（Nest 官方，配套 `CacheInterceptor` / `CacheModule.registerAsync`） |
| 底层 Store | `cache-manager` v6 + `@keyv/redis`（v6 起官方推荐 Keyv，老版 `cache-manager-redis-store` 已停止维护） |
| Redis 协议客户端 | 由 `@keyv/redis` 自带 `redis`（node-redis）依赖，无需另外安装 |
| 模型 | 单例 `RedisModule`（global = true），暴露 `CacheService` 与 `CACHE_MANAGER` |
| 序列化 | Keyv 默认 JSON 序列化，自动支持对象/数组 |

**取舍说明**

- 选择 `@nestjs/cache-manager` 而非直接封装 `ioredis`，是为了：
  - 与 Nest 装饰器（`@UseInterceptors(CacheInterceptor)`）天然兼容；
  - TTL、Key 命名等接口标准化；
  - 后续若需要 Cluster / Pub/Sub，可在 `CacheService` 内部追加一个独立的 `ioredis` 实例并通过同一个 Module 暴露，不会破坏外部 API。
- 不直接使用 `cache-manager-redis-store`：在 cache-manager v6 中已不兼容，且仓库长期未维护。

---

## 三、依赖与版本

新增到 `apps/server/package.json`：

```jsonc
{
  "dependencies": {
    "@nestjs/cache-manager": "^3.0.0",
    "cache-manager": "^6.4.0",
    "@keyv/redis": "^4.0.0",
    "cacheable": "^1.8.0" // cache-manager v6 的依赖，可能由上游自动带入，按 lock 文件确认
  }
}
```

> 具体版本以 yarn 解析为准；执行 `yarn workspace @my-first-nest/server add @nestjs/cache-manager cache-manager @keyv/redis`。

---

## 四、配置改造

### 4.1 环境变量

`apps/server/.env.example` 追加：

```bash
# ===================================================================
# Redis (Optional - 不提供时缓存模块自动降级为内存 store)
# ===================================================================
# REDIS_URL=redis://localhost:6379
# 或者使用单独的连接参数
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=
# REDIS_DB=0
# 缓存默认 TTL，单位：秒（0 表示不过期）
# REDIS_DEFAULT_TTL=300
# Key 前缀，用于多实例 / 多环境隔离
# REDIS_KEY_PREFIX=my-first-nest:
```

### 4.2 Joi 校验（`env.validation.ts`）

```ts
// 追加字段
REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }),
REDIS_HOST: Joi.string(),
REDIS_PORT: Joi.number().port().default(6379),
REDIS_PASSWORD: Joi.string().allow(''),
REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
REDIS_DEFAULT_TTL: Joi.number().integer().min(0).default(300),
REDIS_KEY_PREFIX: Joi.string().default('my-first-nest:'),
```

并参照现有 `DATABASE_URL` / `DATABASE_HOST` 的 `xor` 约束：

```ts
.xor('REDIS_URL', 'REDIS_HOST').optional() // 二选一，可都不提供
```

> 二者皆未提供时，应用以「内存 store」启动，方便本地与测试场景（避免强依赖 Redis）。

### 4.3 类型与默认值

`configuration.interface.ts` 追加：

```ts
export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  defaultTtl?: number;
  keyPrefix?: string;
}

export interface AppConfig {
  // ...existing
  redis?: RedisConfig;
}
```

`config.default.ts` 追加 `redis` 段，读取上述环境变量。

---

## 五、目录与模块设计

复用项目已预留的 `apps/server/src/shared/cache/` 目录（当前为空，因根 `.gitignore` 含 `cache` 规则，实际落地改为 `shared/caching/`）：

```
apps/server/src/shared/caching/
├── cache.module.ts          # RedisModule（@Global，注册 @nestjs/cache-manager）
├── cache.service.ts         # 统一封装 get/set/del/wrap/mget 等方法
├── cache.constants.ts       # Key 命名空间常量，例如 CACHE_KEYS.USER_BY_ID(id)
├── cache.health.ts          # 健康检查 indicator（轻量 ping）
└── index.ts                 # 不导出 barrel，仅当作内部入口（遵循项目"禁止桶导出"规范）
```

> 项目代码规范明确禁止桶导出，此处 `index.ts` 仅在必要时存在；模块外部直接从具体文件 import。

### 5.1 `cache.module.ts`

要点：

- `CacheModule.registerAsync({ isGlobal: true, useFactory })`；
- `useFactory` 通过 `getConfig(configService)` 读取 `redis` 段；
- 当 `redis.url` 或 `redis.host` 任一存在 → 构造 `KeyvRedis` 实例，否则使用默认内存 store；
- 配置 `ttl` = `redis.defaultTtl * 1000`（cache-manager v6 单位毫秒）；
- 提供 `CacheService`、`CacheHealthIndicator`，并将本模块标记为 `@Global()`。

伪代码：

```ts
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [AppConfigModule],
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { redis } = getConfig(config);
        const useRedis = Boolean(redis.url || redis.host);
        const stores = useRedis
          ? [new KeyvRedis(redis.url ?? buildUrl(redis), { namespace: redis.keyPrefix })]
          : undefined; // 走默认内存 store
        return {
          stores,
          ttl: redis.defaultTtl * 1000,
        };
      },
    }),
  ],
  providers: [CacheService, CacheHealthIndicator],
  exports: [CacheService, CacheHealthIndicator],
})
export class RedisCacheModule {}
```

### 5.2 `cache.service.ts`

对外暴露的最小 API：

```ts
class CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string | string[]): Promise<void>;
  /** 如果命中则返回，未命中则执行 loader 并写入 */
  wrap<T>(key: string, loader: () => Promise<T>, ttlSeconds?: number): Promise<T>;
  /** 按命名空间清空（基于 keyPrefix + pattern）— 仅当底层为 Redis 时支持 */
  invalidatePattern(pattern: string): Promise<void>;
}
```

- `get/set/del` 直接转发到 `Cache`（`@Inject(CACHE_MANAGER)`）。
- `wrap` 内部实现：先 `get`，未命中再 `loader()` + `set`，并发场景的"惊群"问题在本期不引入分布式锁，记录为已知限制。
- `invalidatePattern` 仅在底层为 Redis 时支持（通过 `SCAN` + `DEL`，不使用 `KEYS`）；非 Redis 抛 `Not implemented` 或 no-op，并打印 warning。

### 5.3 `cache.constants.ts`

- 集中维护 Key 工厂函数，避免散落字符串拼接。
- 强制使用项目级前缀 + 业务域：

```ts
export const CacheKeys = {
  USER_BY_ID: (id: string) => `users:${id}`,
  ROLE_TREE: (roleId: string) => `roles:tree:${roleId}`,
} as const;
```

- 与 `keyPrefix` 配合后最终落地 Key 形如 `my-first-nest:users:<id>`。

### 5.4 健康检查

- 提供 `CacheHealthIndicator`：执行 `PING`（cache-manager v6 可通过底层 store 拿到 client 引用），超时阈值 1s。
- 不强制接入 `@nestjs/terminus`（项目尚未引入）；本期仅在启动期 `onModuleInit` 内做一次连接校验，失败时**默认降级为内存 store 并打印 warning**，可通过 `REDIS_REQUIRED=true` 切换为"直接抛错终止启动"。
- `REDIS_REQUIRED` 纳入 Joi 校验（`Joi.boolean().default(false)`）。

### 5.5 注册到 `AppModule`

```ts
@Module({
  imports: [AppConfigModule, DatabaseModule, RedisCacheModule, StaticModule, ...modules],
  // ...
})
```

放在 `DatabaseModule` 之后、业务 `modules` 之前。

---

## 六、Docker 与本地开发

### 6.1 新增 `docker/docker-compose.cache.yml`

```yaml
version: '3.9'
services:
  redis:
    image: redis:7-alpine
    container_name: first-nest-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    command: ['redis-server', '--appendonly', 'yes']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  redis-data:
```

### 6.2 现有 `docker-compose.app.yml` / `docker-compose.local.yml`

- 在 app 服务的 `depends_on` 中新增 `redis: { condition: service_healthy }`；
- 注入环境变量 `REDIS_URL=redis://redis:6379`。

### 6.3 README

- 在 README 的 "Docker → 启动服务" 小节追加：
  ```bash
  docker-compose -f docker/docker-compose.cache.yml up -d
  ```
- 将 `Redis 缓存集成` 在路线图标记为已完成。

---

## 七、文档与笔记产出

1. 本方案文档：`docs/redis-cache-integration.md`（即本文件）。
2. 评审通过后，在 `apps/docs/src/notes/` 下新增对外用户文档 `redis-cache.md`，并：
   - 在 `apps/docs/.vitepress/sidebars/notes.ts` 追加条目。
   - 内容聚焦"如何在业务模块中使用 CacheService 与 CacheInterceptor"。
3. `roadmap.md`（apps/docs）与 README 中的路线图同步勾选。

> 评审通过前不修改用户文档与 sidebars，避免出现指向不存在功能的链接。

---

## 八、风险与已知限制

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| 缓存惊群 | `wrap` 在高并发未命中时可能多次回源 | 本期接受；后续接入分布式锁（单独 issue） |
| 缓存与 DB 不一致 | 业务模块写后未失效缓存 | 本期不接入业务模块，统一在后续 PR 处理；建议采用 Cache-Aside 配合显式 `del`，避免事务边界外的 stale 数据 |
| 大 Key / 大 Value | JSON 序列化大对象占用内存 | `CacheService` 文档约定单值上限（建议 < 256KB），超出由业务自行分片 |
| Redis 不可用阻塞启动 | `REDIS_REQUIRED=true` 时启动失败 | 提供降级开关，并在日志中明确指出当前 store 类型 |
| Keyv 命名空间冲突 | 多服务共享同一 Redis 实例 | 通过 `REDIS_KEY_PREFIX` 强隔离 |

---

## 九、验证清单

- [ ] 不配置 Redis 环境变量时，应用可正常启动并使用内存 store。
- [ ] 配置 `REDIS_URL` 时，应用启动后能 `PING` 通。
- [ ] `REDIS_REQUIRED=true` 且 Redis 不可达时，启动报错并退出。
- [ ] `CacheService.set` → `get` 能正确读回原值；TTL 到期后读不到。
- [ ] `wrap` 命中时不调用 loader，未命中时调用一次并写入。
- [ ] `del` 单 Key 与数组 Key 都生效。
- [ ] `invalidatePattern` 在内存 store 下打印 warning 且不抛错。
- [ ] `Joi` 拒绝非法的 `REDIS_URL`（非 redis/rediss scheme）。
- [ ] Docker compose 拉起后，应用容器能通过 service name 连接 redis。

---

## 十、实施顺序（单 PR 推进）

单个 PR 一次性提交，内部按以下提交顺序组织（便于 review 时分段查看 diff）：

1. **commit 1 — 配置与类型**
   - `.env.example`、`env.validation.ts`、`configuration.interface.ts`、`config.default.ts`。
   - 纯配置层，不引入运行时依赖。

2. **commit 2 — 依赖与 Module 骨架**
   - 安装 `@nestjs/cache-manager`、`cache-manager`、`@keyv/redis`。
   - 实现 `RedisCacheModule` + `CacheService` 骨架，挂到 `AppModule`。

3. **commit 3 — CacheService 完整实现**
   - 实现 `get/set/del/wrap/invalidatePattern` 与 `CacheHealthIndicator`。
   - 单测按需补充（仅纯函数与边界场景，遵循 CLAUDE.md 测试规范，补测前先确认）。

4. **commit 4 — Docker 与文档**
   - `docker/docker-compose.cache.yml`、修改现有 compose、README、`apps/docs/src/notes/redis-cache.md`、`sidebars/notes.ts`、路线图勾选。

> PR 提交前需在 `apps/server` 内通过 `yarn lint && yarn build`，并完成第九节"验证清单"。

---

## 十一、后续可拓展项（非本期）

- Session 管理：登录态、RefreshToken 黑名单。
- 接口限流：基于 Redis 的滑动窗口 / 令牌桶。
- 分布式锁：`SET NX PX` + Lua 释放。
- WebSocket 适配器：`@socket.io/redis-adapter` 多实例广播。
- Pub/Sub：领域事件总线雏形。

以上每一项都建议保留独立 issue 单独评审，避免本期范围膨胀。
