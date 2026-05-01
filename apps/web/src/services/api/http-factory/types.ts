import type { AxiosRequestConfig, AxiosResponse } from "axios";

/**
 * 请求内部状态。
 */
export interface RequestRetryState {
  _retry?: boolean;
}

/**
 * 创建 HTTP 客户端时可传入的配置。
 */
export interface HttpClientOptions {
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
   * 获取当前 access token。
   */
  getAccessToken: () => string | null | Promise<string | null>;

  /**
   * 自定义刷新逻辑，必须返回最终要用于重试请求的 access token。
   */
  refreshAccessToken?: () => string | Promise<string>;

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
  | "shouldRefreshByResponseData"
  | "onAuthFailure"
  | "isRefreshFailure";

type ResolvedHttpClientOptionOverrides = {
  [K in ResolvedHttpClientOptionKeys]-?: NonNullable<HttpClientOptions[K]>;
};

export type ResolvedHttpClientOptions = Omit<
  HttpClientOptions,
  ResolvedHttpClientOptionKeys
> &
  ResolvedHttpClientOptionOverrides;
