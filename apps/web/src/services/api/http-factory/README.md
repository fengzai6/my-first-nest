# `http-factory`

`createHttpClient` 是一个基于 `axios` 的 HTTP 客户端工厂函数，用来创建“带统一鉴权、自动刷新 access token 和错误归一化”的请求实例。

## 实现了什么

- 创建一个业务侧可直接使用的 `AxiosInstance`
- 在请求阶段按需自动注入 `accessToken`
- 遇到 `401` 或业务侧指定场景时自动尝试刷新 access token
- 刷新请求由业务侧在 `refreshAccessToken` 中自行发起
- 通过 `TokenRefreshManager` 合并并发刷新，避免同一时刻重复刷新
- 成功时返回原始 `AxiosResponse`
- 支持自定义业务成功判定、业务错误映射、刷新失败判定
- 刷新失败或重试失败后统一执行 `onAuthFailure`
- 大多数 axios 错误会统一归一化为带有 `status`、`data`、`response` 的 `Error`

## 目录说明

- `http-client.ts`
  - 工厂函数 `createHttpClient`
- `types.ts`
  - 配置类型、请求选项
- `token-refresh-manager.ts`
  - 并发刷新控制
- `http-demo.ts`
  - `browserTokenStore`、示例实例、示例调用
- `index.ts`
  - 对外导出入口

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

## 请求约定

这个工厂不再暴露额外的请求级开关：

- 会自动注入 `accessToken`（内部刷新请求除外）
- 配置了刷新能力时，遇到 `401` 或指定业务场景会自动尝试刷新
- 未配置刷新能力时，`401` 会直接触发 `onAuthFailure`
- `_retry` 仅作为内部状态使用，不对业务侧开放

如果某类请求不希望带鉴权、不希望走自动刷新，建议直接使用独立的 `axios` 实例。

## 默认流程

1. 创建 `instance`
2. 给 `instance` 挂请求拦截器
3. 请求时读取 `accessToken`，并按配置注入请求头
4. 响应时优先处理：
   - 业务 token 失效判断
   - 业务成功判断
   - 成功时返回原始 `AxiosResponse`
5. 若需要刷新 access token：
   - 先判断是否启用了刷新能力
   - 进入并发刷新保护
   - 调用业务侧 `refreshAccessToken`
   - 重放原请求
6. 若刷新失败：
   - 执行 `onAuthFailure`
   - 抛出归一化后的错误

## 适用场景

适合这类前端项目：

- 需要统一接入 JWT / access token
- 有 refresh token 续期逻辑
- 希望把 token 存储完全交给业务侧处理
- 希望把请求层错误对象统一成一套结构
- 希望保留 axios 原生 `AxiosResponse` 返回语义

## 测试覆盖

### createHttpClient

1. 会透传 axiosConfig 给 axios.create
2. 并发 401 请求只刷新一次，并在重试时使用新 token
3. 显式传入的鉴权 header 不会被 token 注入覆盖
4. refresh 失败时只触发 onAuthFailure
5. 业务响应命中 accessToken 失效 code 时会刷新并重试
6. refresh 返回空字符串 refreshToken 时会交给使用者自行处理
7. 未启用刷新时，401 会触发 onAuthFailure 且不会读取 refreshToken
8. 非 401 的 axios 错误会被归一化为 HttpError
9. 重试后的请求再次返回 401 时会停止重试并退出登录

### createHttpClient edge cases

1. 自定义 unauthorizedStatusCode 命中时会刷新并重试
2. 业务响应要求刷新但未启用刷新时会原样返回响应
3. 并发 401 请求在 refresh 返回 500 时只触发一次 onAuthFailure
4. refresh 错误命中 authFailureCodes 时会视为登录过期
5. refresh 抛出非 Error 异常时会归一化为未知错误
