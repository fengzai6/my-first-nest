import type { AxiosRequestConfig, AxiosResponse } from "axios";

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

  /**
   * 触发刷新流程的 HTTP 状态码。
   * 默认 `401`。
   */
  unauthorizedStatusCode?: number;

  /**
   * 业务状态码中，用于识别鉴权失败的 code 列表。
   */
  authFailureCodes?: number[];

  /**
   * 不触发 refresh token 流程的请求 URL 列表。
   */
  skipRefreshUrls?: string[];

  /**
   * 提前刷新的毫秒数，默认 60000（1 分钟）。
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
   * 获取当前 access token。
   *
   * 返回 `string` 时仅注入 token，不做主动刷新判断。
   * 返回 `AccessTokenDetail` 时，会在 token 即将过期前主动触发刷新。
   */
  getAccessToken: () => T | Promise<T>;

  /**
   * 自定义刷新逻辑，返回类型必须与 getAccessToken 一致。
   * 返回 AccessTokenDetail 时可携带新的过期时间，避免后续请求因旧过期时间重复触发刷新。
   */
  refreshAccessToken?: () => T | Promise<T>;

  /**
   * 登录失效后的统一收尾回调。
   */
  onAuthFailure?: (error?: unknown) => void | Promise<void>;

  /**
   * 自定义业务响应是否成功的判定逻辑。
   */
  isBusinessSuccess?: (response: AxiosResponse<unknown>) => boolean;

  /**
   * 将业务失败响应映射为错误对象。
   */
  mapBusinessError?: (response: AxiosResponse<unknown>) => Error;

  /**
   * 通过业务响应内容判断是否需要刷新 token。
   */
  shouldRefreshByResponseData?: (response: AxiosResponse<unknown>) => boolean;

  /**
   * 判断刷新 token 请求本身是否已经失败到需要退出登录。
   */
  isRefreshFailure?: (error: unknown) => boolean;
}

/**
 * 补齐默认值后的完整配置类型，仅供内部使用。
 */
type ResolvedHttpClientOptionKeys =
  | "authFailureCodes"
  | "accessTokenHeaderName"
  | "accessTokenPrefix"
  | "unauthorizedStatusCode"
  | "isBusinessSuccess"
  | "mapBusinessError"
  | "skipRefreshUrls"
  | "refreshBufferMs"
  | "refreshCooldownMs"
  | "shouldRefreshByResponseData"
  | "onAuthFailure"
  | "isRefreshFailure";

type ResolvedHttpClientOptionOverrides<T extends AccessTokenResult> = {
  [K in ResolvedHttpClientOptionKeys]-?: NonNullable<HttpClientOptions<T>[K]>;
};

export type ResolvedHttpClientOptions<T extends AccessTokenResult = AccessTokenResult> = Omit<
  HttpClientOptions<T>,
  ResolvedHttpClientOptionKeys
> &
  ResolvedHttpClientOptionOverrides<T>;
