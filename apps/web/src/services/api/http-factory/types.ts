import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import type { TokenRefreshManager } from "./token-refresh-manager";

/**
 * token 详细信息，用于主动刷新判断。
 */
export interface AccessTokenDetail {
  token: string;
  expiresAt: Date | string | number;
}

/**
 * getAccessToken 的返回值类型，兼容旧版纯字符串返回。
 */
export type AccessTokenResult = string | AccessTokenDetail | null;

/**
 * 请求内部状态。
 */
export interface RequestRetryState {
  _retry?: boolean;
}

/**
 * 错误上下文，传递给 onError 钩子。
 */
export interface ErrorContext {
  /**
   * 错误来源类型。
   */
  type: "request" | "refresh";
}

/**
 * 自定义错误消息。
 */
export interface ErrorMessages {
  refreshTokenExpired?: string;
  loginExpired?: string;
}

/**
 * 创建 HTTP 客户端时可传入的配置。
 *
 * @typeParam T - getAccessToken / refreshAccessToken 的统一返回类型，
 *   默认为 `AccessTokenResult`。当 T 为 `AccessTokenDetail` 时启用主动刷新。
 */
export interface HttpClientOptions<T extends AccessTokenResult = AccessTokenResult> {
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
   * - 仅处理 axios 错误（有 response 属性）
   * - 状态码 >= 500 时不视为刷新失败（服务端错误，可能是临时问题）
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
   * - 可以是 async
   */
  onBusinessResponse?: (response: AxiosResponse<unknown>) => Error | void | Promise<Error | void>;

  /**
   * 全局错误钩子。
   * - 返回 Error：用新错误替换原错误
   * - 返回 void：继续抛出原错误
   * - 可以是 async
   *
   * error 类型为 AxiosError | Error：
   * - 请求失败时为 AxiosError，可通过 axios.isAxiosError(error) 收窄访问 response/config
   * - 刷新失败时可能为 AxiosError 或业务侧抛出的任意 Error
   * - 登录过期等内部构造的错误为普通 Error
   */
  onError?: (error: AxiosError | Error, context: ErrorContext) => AxiosError | Error | void | Promise<AxiosError | Error | void>;
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

export type ResolvedHttpClientOptions<T extends AccessTokenResult = AccessTokenResult> = Omit<
  HttpClientOptions<T>,
  ResolvedHttpClientOptionKeys
> &
  ResolvedHttpClientOptionOverrides<T>;
