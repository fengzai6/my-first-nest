# `http-factory`

`createHttpClient` 是一个基于 `axios` 的 HTTP 客户端工厂函数，用来创建"带统一鉴权、自动刷新 access token"的请求实例。

## 实现了什么

- 创建一个业务侧可直接使用的 `AxiosInstance`
- 在请求阶段按需自动注入 `accessToken`
- 遇到 `401` 或业务侧指定场景时自动尝试刷新 access token
- 刷新请求由业务侧在 `refreshAccessToken` 中自行发起
- 通过 `TokenRefreshManager` 合并并发刷新，避免同一时刻重复刷新
- 成功时返回原始 `AxiosResponse`
- 支持自定义业务响应拦截（`onBusinessResponse`）、全局错误钩子（`onError`）、刷新失败判定
- 刷新失败或重试失败后统一执行 `onAuthFailure`
- 错误直接透传 axios 原始错误，不额外包装
- 支持通用重试策略（`retryPolicy`）：5xx 或网络错误时自动重试，指数退避
- 支持请求合并（`dedupePolicy`）：相同 in-flight 请求复用同一个 Promise（默认仅 GET）
- 支持运行时动态 headers（`headersProvider`）：每次请求时注入自定义 headers

## 目录说明

```
http-factory/
├── index.ts                       # 工厂函数 createHttpClient，对外导出入口
├── constants.ts                   # 默认错误消息、默认缓冲时间
├── token-refresh-manager.ts       # 并发刷新控制
├── dedupe-manager.ts              # 请求合并管理
├── types/
│   ├── common.ts                  # RequestRetryState、ErrorContext、BusinessResponseResult
│   ├── http-client-options.ts     # HttpClientOptions、RetryPolicy、DedupePolicy
│   └── token.ts                   # AccessTokenResult、AccessTokenDetail
├── utils/
│   ├── error.ts                   # normalizeError、invokeOnError
│   ├── refresh.ts                 # shouldSkipRefresh、defaultIsRefreshFailure、resolveRetryPolicy
│   └── token.ts                   # formatAccessToken、normalizeTokenResult、isTokenExpiringSoon
├── reference/
│   ├── http-demo.ts               # browserTokenStore、示例实例、示例调用
│   └── README.md                  # 本文件
└── __tests__/                     # 测试文件
```

## 基本用法

```ts
import { createHttpClient } from "@/services/api/http-factory";

const http = createHttpClient({
  axiosConfig: {
    baseURL: "/api",
    timeout: 15 * 1000,
  },
  getAccessToken: () => localStorage.getItem("access_token"),
  refreshAccessToken: async () => {
    const refreshToken = localStorage.getItem("refresh_token");

    if (!refreshToken) {
      throw new Error("refreshToken 不存在");
    }

    const response = await axios.post("/auth/refresh", { refreshToken });

    const data = response.data as {
      accessToken?: string;
      refreshToken?: string;
    };

    if (!data.accessToken) {
      throw new Error("refresh 响应缺少 accessToken");
    }

    localStorage.setItem("access_token", data.accessToken);

    if (data.refreshToken !== undefined) {
      localStorage.setItem("refresh_token", data.refreshToken);
    }

    return data.accessToken;
  },
  onAuthFailure: async () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },
});

const profile = await http.get("/account/profile");
const profileData = profile.data;
```

## 配置项

### Token 注入

- **`getAccessToken`** — 获取当前 access token。返回 `string` 时仅注入 token；返回 `AccessTokenDetail` 时会在 token 即将过期前主动触发刷新
- **`accessTokenHeaderName`** — 注入到请求头的字段名，默认 `Authorization`
- **`accessTokenPrefix`** — token 前缀，默认 `Bearer`
- **`headersProvider`** — 运行时动态 headers 提供者，每次请求时调用，返回的 headers 会合并到请求中（支持同步/异步）

```ts
const http = createHttpClient({
  axiosConfig: { baseURL: "/api" },
  getAccessToken: () => ({
    token: localStorage.getItem("access_token") ?? "",
    expiresAt: localStorage.getItem("expires_at"),
  }),
  headersProvider: () => ({
    "x-request-id": crypto.randomUUID(),
    "x-tenant-id": useAppStore.getState().tenantId,
  }),
});
```

### 错误处理

- **`onBusinessResponse`** — 业务响应拦截器，返回 `void` 表示继续，返回 `Error` 表示业务失败，返回 `AxiosResponse` 会替换原响应
- **`onError`** — 全局错误钩子，在请求失败、刷新失败时触发，可修改错误或执行副作用
- **`errorMessages`** — 覆盖内部默认错误消息（`refreshTokenExpired`、`loginExpired`）
  - 默认文案为中性英文；业务侧如需中文提示，请通过该配置覆盖

```ts
const http = createHttpClient({
  axiosConfig: { baseURL: "/api" },
  getAccessToken: () => localStorage.getItem("access_token"),
  onBusinessResponse: (response) => {
    const data = response.data as { code?: number; message?: string };
    if (data.code !== 0) {
      return new Error(data.message ?? "业务请求失败");
    }
  },
  onError: (error, context) => {
    console.error(`[${context.type}]`, error.message);
  },
  errorMessages: {
    refreshTokenExpired: "登录已过期，请重新登录",
    loginExpired: "登录已失效，请重新登录",
  },
});
```

### 刷新控制

- **`refreshAccessToken`** — 自定义刷新逻辑，返回类型与 `getAccessToken` 一致
- **`shouldRefreshByResponseData`** — 通过业务响应内容判断是否需要刷新 token
- **`refreshBufferMs`** — 提前刷新的毫秒数，默认 `0`（不提前刷新），设置后会在 token 即将过期前异步触发刷新
- **`refreshCooldownMs`** — 刷新后的冷却期，默认 `15000ms`，在冷却期内收到的 401 请求会跳过刷新，直接用新 token 重试
- **`refreshManager`** — 外部传入 `TokenRefreshManager` 实例，用于多个客户端共享同一套 token 刷新逻辑
- **`skipRefreshUrls`** — 不触发 refresh token 流程的请求路径列表
  - 使用路径边界 / 完整路径段匹配，不是任意子串 includes
  - 例如 `/auth` 匹配 `/auth`、`/auth/login`、`/api/auth/login`
  - 不会匹配 `/user/auth-history` 或 `/authorization`

```ts
import { TokenRefreshManager } from "@/services/api/http-factory/token-refresh-manager";

const sharedManager = new TokenRefreshManager(15000);

const http1 = createHttpClient({
  axiosConfig: { baseURL: "/api1" },
  refreshManager: sharedManager,
  // ...
});

const http2 = createHttpClient({
  axiosConfig: { baseURL: "/api2" },
  refreshManager: sharedManager,
  // ...
});
```

### 鉴权失败判定

- **`refreshFailureCodes`** — 仅服务 refresh 失败判定的业务 code 列表（不是通用业务鉴权能力）
  - 只在 `defaultIsRefreshFailure` 中读取响应体 `data.code`
  - 普通请求鉴权失败请用 `shouldRefreshByResponseData` / `onBusinessResponse` / 自定义 `isRefreshFailure`
- **`unauthorizedStatusCode`** — 触发刷新流程的 HTTP 状态码，默认 `401`
- **`isRefreshFailure`** — 判断刷新请求是否已经失败到需要退出登录，默认行为：
  - 非 AxiosError（如业务代码抛出的 Error）→ 视为鉴权失败
  - AxiosError 无 response（网络错误）或 status >= 500 → 不视为鉴权失败（token 可能仍有效）
  - 命中 `unauthorizedStatusCode` 或 `refreshFailureCodes` → 视为鉴权失败

### 重试策略

- **`retryPolicy`** — 通用重试策略，默认不重试
  - `maxRetries` — 最大重试次数（不含首次请求）
  - `shouldRetry` — 自定义重试判断，默认：网络错误（无 response）或 5xx 时重试
  - `retryDelay` — 自定义重试延迟，默认：指数退避 `1000 * 2^retryCount`，上限 30 秒

```ts
const http = createHttpClient({
  axiosConfig: { baseURL: "/api" },
  getAccessToken: async () => "",
  retryPolicy: {
    maxRetries: 2,
    // 可选：自定义重试条件和延迟
    // shouldRetry: (error, retryCount) => ...,
    // retryDelay: (retryCount) => ...,
  },
});
```

### 请求合并

- **`dedupePolicy`** — 请求合并策略，默认关闭
  - `enabled` — 是否启用
  - `methods` — 允许合并的 method 列表，默认 `["get"]`
  - `generateKey` — 自定义合并 key 生成器，默认 `method:baseURL:url:stableParams`
  - `windowMs` — 已废弃，保留仅为兼容旧配置，会被忽略

默认只对 GET 请求生效；可通过 `methods` 扩展。请求级 `dedupePolicy.enabled = false` 可覆盖客户端级配置，禁止单个请求的合并。

鉴权失败（命中 `unauthorizedStatusCode`）会优先于通用 `retryPolicy` 处理，避免 401 被自定义 `shouldRetry` 空耗重试次数。

```ts
const http = createHttpClient({
  axiosConfig: { baseURL: "/api" },
  getAccessToken: async () => "",
  dedupePolicy: {
    enabled: true,
  },
});

// 两个并发请求只会发出一次 HTTP 请求
const [a, b] = await Promise.all([
  http.get("/config"),
  http.get("/config"),
]);
```

## 请求约定

- 会自动注入 `accessToken`（内部刷新请求除外）
- 配置了刷新能力时，遇到 `401` 或指定业务场景会自动尝试刷新
- 未配置刷新能力时，`401` 会直接触发 `onAuthFailure`
- `_retry` 仅作为内部状态使用，不对业务侧开放

如果某类请求不希望带鉴权、不希望走自动刷新，建议直接使用独立的 `axios` 实例。

## 默认流程

1. 创建 `instance`（透传 `axiosConfig`）
2. 给 `instance` 挂请求拦截器和响应拦截器
3. 请求时读取 `accessToken`，并按配置注入请求头，合并 `headersProvider` 返回的动态 headers
4. 响应成功时优先处理：
   - 业务 token 失效判断（`shouldRefreshByResponseData`）
   - 业务响应拦截（`onBusinessResponse`）
   - 成功时返回原始 `AxiosResponse`
5. 响应失败时：
   - 先执行通用重试（`retryPolicy`，5xx / 网络错误）
   - 若为 `401` 且启用了刷新，进入刷新流程
   - 若为 `401` 且未启用刷新，直接触发 `onAuthFailure`
6. 刷新流程：
   - 通过 `TokenRefreshManager` 合并并发刷新
   - 调用业务侧 `refreshAccessToken`
   - 若在冷却期内，跳过刷新，直接用新 token 重试
   - 重放原请求
7. 若刷新失败：
   - 判断是否为鉴权失败（`isRefreshFailure`）
   - 鉴权失败时执行 `onAuthFailure`，使用 `refreshTokenExpired` 消息
   - 非鉴权失败时透传原始错误
   - 抛出错误

## 适用场景

适合这类前端项目：

- 需要统一接入 JWT / access token
- 有 refresh token 续期逻辑
- 希望把 token 存储完全交给业务侧处理
- 希望保留 axios 原生错误结构，自行处理错误格式
- 希望保留 axios 原生 `AxiosResponse` 返回语义
- 需要请求重试（5xx / 网络错误自动重试）
- 需要请求合并（减少重复 GET 请求）
- 需要运行时动态 headers（请求追踪、租户标识等）

## 测试覆盖

### createHttpClient（`http-client.test.ts`）

1. 会透传 axiosConfig 给 axios.create
2. 并发 401 请求只刷新一次，并在重试时使用新 token
3. 显式传入的鉴权 header 不会被 token 注入覆盖
4. getAccessToken 为空时不会注入鉴权 header
5. refresh 失败时会触发 onAuthFailure 并返回登录过期错误
6. 业务响应命中 accessToken 失效 code 时会刷新并重试
7. refresh 返回空字符串 refreshToken 时会交给使用者自行处理
8. 未启用刷新时，401 会触发 onAuthFailure 且不会读取 refreshToken
9. 非 401 的 axios 错误会透传原始错误
10. 重试后的请求再次返回 401 时会停止重试并退出登录
11. 多个客户端共享 TokenRefreshManager 时只刷新一次
12. headersProvider：同步/异步注入、覆盖 Authorization、未配置时不变
13. retryPolicy：5xx 重试、503 重试、超过上限、4xx 不重试、未配置不重试、自定义 shouldRetry、网络错误重试
14. dedupePolicy：相同 GET 合并、不同 URL 不合并、请求级禁用、未配置不合并、POST 不合并、自定义 generateKey
15. onBusinessResponse 返回 AxiosResponse 对象时会替换原响应

### edge cases（`http-client.edge-cases.test.ts`）

1. 命中 skipRefreshUrls 时，401 / 业务响应触发刷新都不会执行 refresh
2. 自定义 unauthorizedStatusCode 命中时会刷新并重试
3. 业务响应要求刷新但未启用刷新时会原样返回响应
4. refresh 成功响应缺少 accessToken 时会触发鉴权失败（refreshToken 已失效）
5. 并发 401 请求在 refresh 返回 500 时不会触发 onAuthFailure（服务端错误不代表 token 失效）
6. 重试后的业务响应再次命中刷新条件时会停止重试并退出登录
7. refresh 进行中时新来的 401 请求会复用同一次 refresh
8. refresh 错误命中 refreshFailureCodes 时会视为登录过期
9. refresh 抛出非 Error 异常时会触发鉴权失败（归一化后作为 refreshToken 失效处理）
10. onAuthFailure 抛错时会透出回调错误而不是原始鉴权错误
11. onBusinessResponse 抛出的特定消息能在 onError 中正常接收

### cooldown（`http-client.cooldown.test.ts`）

1. 刷新完成后旧请求陆续返回 401 → 跳过刷新，用新 token 重试
2. 慢请求卡了 10 秒后返回 401 → 跳过刷新（在冷却期内）
3. 冷却期过后又收到 401 → 正常执行刷新
4. 刷新失败后重试 → 下次可以重新刷新
5. skipRefreshUrls 不触发刷新逻辑
6. 冷却期边界测试（14.9 秒 vs 15.1 秒）

### token normalization（`http-client.token-normalization.test.ts`）

expiresAt 边界：0、空字符串、null、undefined、无效字符串、有效时间戳、Date 对象、ISO 字符串

### 工具函数单元测试

- `http-client.error.test.ts` — normalizeError（Error/对象/可序列化/循环引用）、invokeOnError（void/替换/抛错/异步）
- `http-client.refresh.test.ts` — shouldSkipRefresh（undefined config/url）、defaultIsRefreshFailure（非 AxiosError/无 response/5xx/refreshFailureCodes）
- `http-client.retry-policy.test.ts` — defaultShouldRetry（非 AxiosError/网络错误/5xx/4xx）、defaultRetryDelay（指数退避/上限）、resolveRetryPolicy（undefined/0/负数/自定义）
- `http-client.token.test.ts` — formatAccessToken（空/空格前缀）、normalizeTokenResult（null/undefined/0/空串/无效日期/Date/ISO）
