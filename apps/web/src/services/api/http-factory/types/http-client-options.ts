import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import type { TokenRefreshManager } from "../token-refresh-manager";
import type {
  BusinessResponseResult,
  ErrorContext,
  ErrorMessages,
} from "./common";
import type { AccessTokenResult } from "./token";

/**
 * 请求合并配置。
 */
export interface DedupePolicy {
  /** 是否启用请求合并。默认 false。 */
  enabled?: boolean;

  /**
   * 允许合并的 HTTP method 列表。
   * 默认 `["get"]`，比较时忽略大小写。
   */
  methods?: string[];

  /**
   * @deprecated 已不再使用。当前仅合并仍在进行中的相同请求。
   * 保留字段仅为兼容旧配置，传入后会被忽略。
   */
  windowMs?: number;

  /**
   * 自定义合并 key 生成器。
   * 默认：`method:baseURL:url:stableParams`
   */
  generateKey?: (config: AxiosRequestConfig) => string;
}

// 扩展 AxiosRequestConfig，支持请求级 dedupePolicy
declare module "axios" {
  interface AxiosRequestConfig {
    /** 请求合并策略。覆盖客户端级配置。 */
    dedupePolicy?: DedupePolicy;
  }
}

/**
 * 重试策略配置。
 */
export interface RetryPolicy {
  /** 最大重试次数（不含首次请求）。默认 0（不重试）。 */
  maxRetries?: number;

  /**
   * 判断是否需要重试。
   * 默认：网络错误（无 response）或 5xx 状态码时重试。
   */
  shouldRetry?: (error: unknown, retryCount: number) => boolean;

  /**
   * 计算重试延迟（毫秒）。
   * 默认：指数退避，公式 `1000 * 2^retryCount`，上限 30 秒。
   */
  retryDelay?: (retryCount: number) => number;
}

/**
 * 创建 HTTP 客户端时可传入的配置。
 *
 * @typeParam T - getAccessToken / refreshAccessToken 的统一返回类型，
 *   默认为 `AccessTokenResult`。当 T 为 `AccessTokenDetail` 时启用主动刷新。
 */
export interface HttpClientOptions<
  T extends AccessTokenResult = AccessTokenResult,
> {
  /**
   * 透传给 axios.create 的初始化配置。
   */
  axiosConfig: AxiosRequestConfig;

  // ---- Token ----

  /**
   * 获取当前 access token。
   *
   * 返回 `string` 时仅注入 token，不做主动刷新判断。
   * 返回 `AccessTokenDetail` 时，会在 token 即将过期前主动触发刷新。
   */
  getAccessToken: () => T | Promise<T>;

  /**
   * access token 注入到请求头时使用的字段名。
   * 默认 `Authorization`。
   */
  accessTokenHeaderName?: string;

  /**
   * access token 的前缀。
   * 默认 `Bearer`。
   */
  accessTokenPrefix?: string;

  // ---- Auth failure ----

  /**
   * 业务状态码中，用于识别鉴权失败的 code 列表。
   */
  authFailureCodes?: number[];

  /**
   * 通用重试策略。
   * 默认不重试（maxRetries: 0）。
   */
  retryPolicy?: RetryPolicy;

  /**
   * 请求合并策略。
   * 默认关闭（enabled: false）。
   */
  dedupePolicy?: DedupePolicy;

  /**
   * 运行时动态 headers 提供者。
   *
   * 每次请求时调用，返回的 headers 会合并到请求中。
   * 支持同步或异步返回。
   *
   * 典型场景：
   * - 请求追踪：`{ 'x-trace-id': crypto.randomUUID() }`
   * - 业务标识：从 store 读取 `{ 'x-tenant-id': tenantId }`
   *
   * 注意：返回的 headers 会覆盖默认注入的 headers（如 Authorization）。
   */
  headersProvider?: () =>
    | Record<string, string>
    | Promise<Record<string, string>>;

  /**
   * 触发刷新流程的 HTTP 状态码。
   * 默认 `401`。
   */
  unauthorizedStatusCode?: number;

  /**
   * 自定义错误消息，覆盖内部默认值。
   */
  errorMessages?: ErrorMessages;

  /**
   * 判断刷新 token 请求本身是否已经失败到需要退出登录。
   *
   * 默认行为：
   * - 非 AxiosError（如 refreshAccessToken 函数内部抛出的业务错误）视为刷新失败
   * - AxiosError 无 response（网络错误）或状态码 >= 500 时不视为刷新失败
   * - 状态码 === unauthorizedStatusCode 时视为刷新失败
   * - 响应 data.code 在 authFailureCodes 列表中时视为刷新失败
   */
  isRefreshFailure?: (error: unknown) => boolean;

  // ---- Refresh ----

  /**
   * 自定义刷新逻辑，返回类型必须与 getAccessToken 一致。
   * 返回 AccessTokenDetail 时可携带新的过期时间，避免后续请求因旧过期时间重复触发刷新。
   */
  refreshAccessToken?: () => T | Promise<T>;

  /**
   * 不触发 refresh token 流程的请求 URL 列表。
   */
  skipRefreshUrls?: string[];

  /**
   * 提前刷新的毫秒数，默认 0（不提前刷新）。
   * 设置为大于 0 的值时，会在 token 即将过期前主动触发刷新。
   */
  refreshBufferMs?: number;

  /**
   * 刷新 token 后的冷却期（毫秒）。
   * 在冷却期内收到的 401 请求会跳过刷新，直接使用新 token 重试。
   * 用于处理刷新完成后，旧请求陆续返回 401 的并发场景。
   * 默认 15000（15 秒）。
   */
  refreshCooldownMs?: number;

  /**
   * 外部传入的 TokenRefreshManager 实例。
   * 用于多个客户端共享同一套 token 刷新逻辑。
   * 不传则自动创建独立实例。
   */
  refreshManager?: TokenRefreshManager;

  /**
   * 通过业务响应内容判断是否需要刷新 token。
   */
  shouldRefreshByResponseData?: (response: AxiosResponse<unknown>) => boolean;

  // ---- Callbacks ----

  /**
   * 登录失效后的统一收尾回调。
   */
  onAuthFailure?: (error?: unknown) => void | Promise<void>;

  /**
   * 业务响应拦截器。
   * - 返回 void：继续正常流程（表示成功）
   * - 返回 Error：抛出错误（表示业务失败）
   * - 返回 AxiosResponse：用新响应替换原响应，不会二次触发 onBusinessResponse
   * - 可以是 async
   */
  onBusinessResponse?: (
    response: AxiosResponse<unknown>,
  ) => BusinessResponseResult | Promise<BusinessResponseResult>;

  /**
   * 全局错误钩子。
   * - 返回 Error：用新错误替换原错误
   * - 返回 void：继续抛出原错误
   * - 可以是 async
   *
   * error 类型为 AxiosError | Error：
   * - 请求失败时为 AxiosError，可通过 axios.isAxiosError(error) 收敛访问 response/config
   * - 刷新失败时可能为 AxiosError 或业务侧抛出的任意 Error
   * - 登录过期等内部构造的错误为普通 Error
   */
  onError?: (
    error: AxiosError | Error,
    context: ErrorContext,
  ) => AxiosError | Error | void | Promise<AxiosError | Error | void>;
}

/**
 * 补齐默认值后的完整配置类型，仅供内部使用。
 */
type ResolvedHttpClientOptionKeys =
  | "accessTokenHeaderName"
  | "accessTokenPrefix"
  | "authFailureCodes"
  | "unauthorizedStatusCode"
  | "errorMessages"
  | "isRefreshFailure"
  | "skipRefreshUrls"
  | "refreshBufferMs"
  | "shouldRefreshByResponseData";

type ResolvedHttpClientOptionOverrides<T extends AccessTokenResult> = {
  [K in ResolvedHttpClientOptionKeys]-?: NonNullable<HttpClientOptions<T>[K]>;
};

export type ResolvedHttpClientOptions<
  T extends AccessTokenResult = AccessTokenResult,
> = Omit<HttpClientOptions<T>, ResolvedHttpClientOptionKeys> &
  ResolvedHttpClientOptionOverrides<T>;
