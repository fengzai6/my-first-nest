import type { ErrorContext } from "../types/common";

/**
 * 将任意值标准化为 Error 实例。
 */
export const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return new Error(error.message);
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
};

/**
 * 调用错误回调，返回最终错误。
 */
export const invokeOnError = async (
  error: Error,
  context: ErrorContext,
  onError?: (
    error: Error,
    context: ErrorContext,
  ) => Error | void | Promise<Error | void>,
): Promise<Error> => {
  if (!onError) {
    return error;
  }

  try {
    const result = await onError(error, context);
    return result ?? error;
  } catch {
    return error;
  }
};
