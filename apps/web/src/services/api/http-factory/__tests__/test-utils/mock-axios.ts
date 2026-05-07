import axios from "axios";
import { afterEach, vi } from "vitest";

type MockHandler = (config: any) => Promise<any>;

type MatchedMockHandler = {
  handler: MockHandler;
  matcher: (config: any) => boolean;
};

const mockHandlers: MockHandler[] = [];
const matchedMockHandlers: MatchedMockHandler[] = [];

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");

  class MockAxiosInstance {
    public interceptors = {
      request: {
        handlers: [] as Array<{
          fulfilled?: (value: any) => any;
          rejected?: (error: unknown) => unknown;
        }>,
        use: (
          fulfilled?: (value: any) => any,
          rejected?: (error: unknown) => unknown,
        ) => {
          this.interceptors.request.handlers.push({ fulfilled, rejected });
          return this.interceptors.request.handlers.length - 1;
        },
      },
      response: {
        handlers: [] as Array<{
          fulfilled?: (value: any) => any;
          rejected?: (error: unknown) => unknown;
        }>,
        use: (
          fulfilled?: (value: any) => any,
          rejected?: (error: unknown) => unknown,
        ) => {
          this.interceptors.response.handlers.push({ fulfilled, rejected });
          return this.interceptors.response.handlers.length - 1;
        },
      },
    };

    async request(config: any) {
      let nextConfig = config;

      for (const handler of this.interceptors.request.handlers) {
        if (handler.fulfilled) {
          nextConfig = await handler.fulfilled(nextConfig);
        }
      }

      const matchedHandlerIndex = matchedMockHandlers.findIndex(({ matcher }) => {
        return matcher(nextConfig);
      });

      const handler =
        matchedHandlerIndex >= 0
          ? matchedMockHandlers.splice(matchedHandlerIndex, 1)[0]?.handler
          : mockHandlers.shift();

      if (!handler) {
        throw new Error(
          `No mock handler for ${nextConfig.method || "get"} ${nextConfig.url}`,
        );
      }

      try {
        let response = await handler(nextConfig);

        if (!response.config) {
          response = { ...response, config: nextConfig };
        }

        for (const responseHandler of this.interceptors.response.handlers) {
          if (responseHandler.fulfilled) {
            response = await responseHandler.fulfilled(response);
          }
        }

        return response;
      } catch (error) {
        let nextError = error;

        if (
          nextError &&
          typeof nextError === "object" &&
          !("config" in nextError)
        ) {
          if (nextError instanceof Error) {
            Object.assign(nextError, { config: nextConfig });
          } else {
            nextError = { ...nextError, config: nextConfig };
          }
        }

        for (const responseHandler of this.interceptors.response.handlers) {
          if (!responseHandler.rejected) continue;

          try {
            return await responseHandler.rejected(nextError);
          } catch (handledError) {
            nextError = handledError;
          }
        }

        throw nextError;
      }
    }

    get(url: string, config?: any) {
      return this.request({ ...config, method: "get", url });
    }

    post(url: string, data?: any, config?: any) {
      return this.request({ ...config, data, method: "post", url });
    }
  }

  return {
    ...actual,
    post: vi.fn((url: string, data?: any, config?: any) => {
      const instance = new MockAxiosInstance();
      return instance.post(url, data, config);
    }),
    default: {
      ...actual.default,
      create: vi.fn(() => new MockAxiosInstance()),
      post: vi.fn((url: string, data?: any, config?: any) => {
        const instance = new MockAxiosInstance();
        return instance.post(url, data, config);
      }),
      isAxiosError: actual.default.isAxiosError,
    },
    create: vi.fn(() => new MockAxiosInstance()),
    isAxiosError: actual.isAxiosError,
  };
});

export const queueResponse = (response: {
  status: number;
  data: unknown;
  config?: any;
}) => {
  mockHandlers.push(async (config) => ({
    ...response,
    config: response.config ?? config,
  }));
};

export const queueCustomHandler = (handler: MockHandler) => {
  mockHandlers.push(handler);
};

export const queueMatchedHandler = (
  matcher: (config: any) => boolean,
  handler: MockHandler,
) => {
  matchedMockHandlers.push({ matcher, handler });
};

export const queueAxiosError = ({
  message = "Request failed",
  status,
  data,
}: {
  message?: string;
  status?: number;
  data?: unknown;
}) => {
  mockHandlers.push(async (config) => {
    const error = new Error(message) as Error & {
      config: any;
      isAxiosError: boolean;
      response?: { status?: number; data?: unknown; config: any };
    };

    error.config = config;
    error.isAxiosError = true;
    error.response = {
      status,
      data,
      config,
    };

    throw error;
  });
};

export const createTokenStore = (
  initialAccessToken: string,
  initialRefreshToken: string,
) => {
  let accessToken = initialAccessToken;
  let refreshToken = initialRefreshToken;
  let staleAccessTokenReadCount = 0;

  return {
    getAccessToken: vi.fn(async () => {
      if (staleAccessTokenReadCount > 0) {
        staleAccessTokenReadCount -= 1;
        return initialAccessToken;
      }

      return accessToken;
    }),
    getRefreshToken: vi.fn(async () => refreshToken),
    setAccessToken: vi.fn((nextAccessToken: string) => {
      accessToken = nextAccessToken;
      staleAccessTokenReadCount = 1;
    }),
    setRefreshToken: vi.fn((nextRefreshToken: string) => {
      refreshToken = nextRefreshToken;
    }),
    clearAuth: vi.fn(() => {
      accessToken = "";
      refreshToken = "";
    }),
  };
};

export const createRefreshAccessToken = (
  tokenStore: ReturnType<typeof createTokenStore>,
) => {
  return async () => {
    const refreshToken = await tokenStore.getRefreshToken();

    if (!refreshToken) {
      throw new Error("missing refreshToken");
    }

    const response = await axios.post("/auth/refresh", { refreshToken });
    const data = response.data as {
      accessToken?: string;
      refreshToken?: string;
    };

    if (!data.accessToken) {
      throw new Error("missing accessToken");
    }

    tokenStore.setAccessToken(data.accessToken);

    if (data.refreshToken !== undefined) {
      tokenStore.setRefreshToken(data.refreshToken);
    }

    return data.accessToken;
  };
};

export const wait = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

afterEach(() => {
  mockHandlers.length = 0;
  matchedMockHandlers.length = 0;
  vi.clearAllMocks();
});
