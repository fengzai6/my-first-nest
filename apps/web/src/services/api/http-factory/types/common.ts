import type { AxiosResponse } from "axios";

/**
 * 请求内部状态。
 */
export interface RequestRetryState {
  /** token 刷新重试标记 */
  _retry?: boolean;
  /** 通用重试计数 */
  __retryCount?: number;
  /** 内部重试旁路 dedupe，避免 pending 自引用死锁 */
  __skipDedupe?: boolean;
}

/**
 * onBusinessResponse 的返回值类型。
 * - void：继续正常流程（表示成功）
 * - Error：抛出错误（表示业务失败）
 * - AxiosResponse：用新响应替换原响应，不会二次触发 onBusinessResponse
 */
export type BusinessResponseResult = void | Error | AxiosResponse;

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
