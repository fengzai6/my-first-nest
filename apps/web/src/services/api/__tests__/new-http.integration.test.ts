import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import type { HttpClientInstance } from "fzkit/http-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshTokenMock = vi.hoisted(() => vi.fn());
const messageErrorMock = vi.hoisted(() => vi.fn());

vi.mock("../refresh-token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../refresh-token")>();

  return {
    ...actual,
    RefreshToken: refreshTokenMock,
  };
});

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();

  return {
    ...actual,
    message: {
      ...actual.message,
      error: messageErrorMock,
    },
  };
});

interface IRequestRecord {
  authorization: string | undefined;
  lastEventId: string | undefined;
  pathname: string;
}

interface IAppAssembly {
  http: HttpClientInstance;
  useUserStore: typeof import("@/stores/user").useUserStore;
  handleRefreshAndReconnect: typeof import("../socket-client").handleRefreshAndReconnect;
  socket: typeof import("../socket-client").socket;
}

const wait = (ms: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const waitFor = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await wait(10);
  }

  throw new Error("等待测试条件超时");
};

const createUnauthorizedError = () => {
  const error = new AxiosError("refresh token 已失效");
  error.response = {
    config: {
      headers: new AxiosHeaders(),
    } as InternalAxiosRequestConfig,
    data: null,
    headers: {},
    status: 401,
    statusText: "Unauthorized",
  };

  return error;
};

const loadAppAssembly = async (): Promise<IAppAssembly> => {
  vi.resetModules();

  const [
    { default: http },
    { useUserStore },
    { handleRefreshAndReconnect, socket },
  ] = await Promise.all([
    import("../new-http"),
    import("@/stores/user"),
    import("../socket-client"),
  ]);

  return {
    http: http as HttpClientInstance,
    useUserStore,
    handleRefreshAndReconnect,
    socket,
  };
};

describe("new-http fzkit 业务装配", () => {
  let dedupeGate: Promise<void>;
  let releaseDedupeGate: () => void;
  let dedupeRequestCount: number;
  let server: Server;
  let serverUrl: string;
  let sseRequestCount: number;
  let sseRequests: IRequestRecord[];

  const writeJson = (
    response: ServerResponse,
    status: number,
    data: unknown,
  ) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(data));
  };

  const handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
  ) => {
    const url = new URL(request.url ?? "/", serverUrl);
    const record: IRequestRecord = {
      authorization: request.headers.authorization,
      lastEventId: Array.isArray(request.headers["last-event-id"])
        ? request.headers["last-event-id"][0]
        : request.headers["last-event-id"],
      pathname: url.pathname,
    };

    if (url.pathname === "/token") {
      writeJson(response, 200, { authorization: record.authorization });
      return;
    }

    if (url.pathname.startsWith("/auth/")) {
      writeJson(response, 401, { message: "unauthorized" });
      return;
    }

    if (url.pathname.startsWith("/protected")) {
      if (record.authorization === "Bearer old-access-token") {
        writeJson(response, 401, { message: "unauthorized" });
        return;
      }

      writeJson(response, 200, { authorization: record.authorization });
      return;
    }

    if (url.pathname === "/error") {
      writeJson(response, 500, { message: "internal server error" });
      return;
    }

    if (url.pathname === "/dedupe") {
      dedupeRequestCount += 1;
      await dedupeGate;
      writeJson(response, 200, { requestCount: dedupeRequestCount });
      return;
    }

    if (url.pathname === "/events") {
      sseRequestCount += 1;
      sseRequests.push(record);

      if (record.authorization === "Bearer old-access-token") {
        response.writeHead(401);
        response.end();
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      });

      if (sseRequestCount === 2) {
        response.end("id: event-1\nevent: update\ndata: refreshed\n\n");
      }
    }
  };

  beforeEach(async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    dedupeRequestCount = 0;
    dedupeGate = new Promise<void>((resolve) => {
      releaseDedupeGate = resolve;
    });
    sseRequestCount = 0;
    sseRequests = [];
    refreshTokenMock.mockReset();
    messageErrorMock.mockReset();

    server = createServer((request, response) => {
      void handleRequest(request, response);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  it("从用户 store 注入 access token", async () => {
    const { http, useUserStore } = await loadAppAssembly();
    http.defaults.baseURL = serverUrl;
    useUserStore.getState().setJwtToken({
      accessToken: "old-access-token",
      expiresAt: Date.now() + 60_000,
    });

    const response = await http.get<{ authorization: string }>("/token");

    expect(response.data.authorization).toBe("Bearer old-access-token");
  });

  it("并发 401 只刷新一次，并以新 token 重放请求", async () => {
    const { http, useUserStore } = await loadAppAssembly();
    http.defaults.baseURL = serverUrl;
    useUserStore.getState().setJwtToken({
      accessToken: "old-access-token",
      expiresAt: Date.now() + 60_000,
    });
    refreshTokenMock.mockImplementation(async () => {
      const refreshedToken = {
        accessToken: "new-access-token",
        expiresAt: Date.now() + 60_000,
      };
      useUserStore.getState().setJwtToken(refreshedToken);
      return refreshedToken;
    });

    const [first, second] = await Promise.all([
      http.get<{ authorization: string }>("/protected/first"),
      http.get<{ authorization: string }>("/protected/second"),
    ]);

    expect(refreshTokenMock).toHaveBeenCalledTimes(1);
    expect(first.data.authorization).toBe("Bearer new-access-token");
    expect(second.data.authorization).toBe("Bearer new-access-token");
  });

  it("刷新鉴权失败时只登出一次，并保留业务错误文案", async () => {
    const { http, useUserStore } = await loadAppAssembly();
    http.defaults.baseURL = serverUrl;
    useUserStore.getState().setJwtToken({
      accessToken: "old-access-token",
      expiresAt: Date.now() + 60_000,
    });
    const logout = vi.spyOn(useUserStore.getState(), "logout");
    let rejectRefresh: (error: AxiosError) => void;
    const refreshFailure = new Promise<never>((_, reject) => {
      rejectRefresh = reject;
    });
    refreshTokenMock.mockReturnValue(refreshFailure);

    const requests = Promise.allSettled([
      http.get("/protected/first"),
      http.get("/protected/second"),
    ]);
    await waitFor(() => refreshTokenMock.mock.calls.length === 1);
    rejectRefresh!(createUnauthorizedError());
    const results = await requests;

    expect(logout).toHaveBeenCalledTimes(1);
    expect(useUserStore.getState().jwtToken).toBeNull();
    expect(results.every((result) => result.status === "rejected")).toBe(true);

    const firstFailure = results[0];
    if (firstFailure?.status !== "rejected") {
      throw new Error("预期请求会因 refresh token 失效而失败");
    }

    expect(firstFailure.reason).toMatchObject({
      message: "登录已过期，请重新登录",
    });
  });

  it("登录与刷新端点的 401 不触发 refresh 或 logout", async () => {
    const { http, useUserStore } = await loadAppAssembly();
    http.defaults.baseURL = serverUrl;
    useUserStore.getState().setJwtToken({
      accessToken: "old-access-token",
      expiresAt: Date.now() + 60_000,
    });
    const logout = vi.spyOn(useUserStore.getState(), "logout");

    await expect(http.post("/auth/login")).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(refreshTokenMock).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it("HTTP 错误日志仅记录脱敏字段", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const { http } = await loadAppAssembly();
      http.defaults.baseURL = serverUrl;

      await expect(http.get("/error")).rejects.toMatchObject({
        response: { status: 500 },
      });

      expect(consoleError).toHaveBeenCalledWith(
        "HTTP Error:",
        expect.objectContaining({ message: expect.any(String) }),
      );
      expect(consoleError.mock.calls.at(-1)?.[1]).not.toHaveProperty("config");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("合并相同的并发 GET 请求", async () => {
    const { http, useUserStore } = await loadAppAssembly();
    http.defaults.baseURL = serverUrl;
    useUserStore.getState().setJwtToken({
      accessToken: "old-access-token",
      expiresAt: Date.now() + 60_000,
    });

    const requests = Promise.all([http.get("/dedupe"), http.get("/dedupe")]);

    await waitFor(() => dedupeRequestCount > 0);
    await wait(20);
    releaseDedupeGate();
    await requests;

    expect(dedupeRequestCount).toBe(1);
  });

  it("SSE 在 401 后刷新重连、续传事件游标，手动关闭不再重连", async () => {
    const { http, useUserStore } = await loadAppAssembly();
    http.defaults.baseURL = serverUrl;
    useUserStore.getState().setJwtToken({
      accessToken: "old-access-token",
      expiresAt: Date.now() + 60_000,
    });
    refreshTokenMock.mockImplementation(async () => {
      const refreshedToken = {
        accessToken: "new-access-token",
        expiresAt: Date.now() + 60_000,
      };
      useUserStore.getState().setJwtToken(refreshedToken);
      return refreshedToken;
    });
    const closeReasons: string[] = [];

    const subscription = http.sse("/events", {
      lastEventId: "seed-event",
      retryDelay: () => 0,
      onClose: (reason) => {
        closeReasons.push(reason);
      },
    });

    await waitFor(() => sseRequestCount === 3);

    expect(refreshTokenMock).toHaveBeenCalledTimes(1);
    expect(sseRequests[0]).toMatchObject({
      authorization: "Bearer old-access-token",
      lastEventId: "seed-event",
    });
    expect(sseRequests[2]).toMatchObject({
      authorization: "Bearer new-access-token",
      lastEventId: "event-1",
    });

    subscription.close();
    await wait(20);

    expect(sseRequestCount).toBe(3);
    expect(closeReasons).toEqual(["manual"]);
  });

  it("HTTP 401 与 socket 并发刷新只走一次 RefreshToken", async () => {
    const { http, useUserStore, handleRefreshAndReconnect, socket } =
      await loadAppAssembly();
    const disconnect = vi.spyOn(socket, "disconnect").mockReturnValue(socket);
    const connect = vi.spyOn(socket, "connect").mockReturnValue(socket);
    http.defaults.baseURL = serverUrl;
    useUserStore.getState().setJwtToken({
      accessToken: "old-access-token",
      expiresAt: Date.now() + 60_000,
    });
    let releaseRefresh: () => void = () => undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    refreshTokenMock.mockImplementation(async () => {
      await refreshGate;
      const refreshedToken = {
        accessToken: "new-access-token",
        expiresAt: Date.now() + 60_000,
      };
      useUserStore.getState().setJwtToken(refreshedToken);
      return refreshedToken;
    });

    const httpRequest = http.get<{ authorization: string }>("/protected/first");
    const socketRefresh = handleRefreshAndReconnect();
    await waitFor(() => refreshTokenMock.mock.calls.length === 1);
    releaseRefresh();
    const [httpResponse] = await Promise.all([httpRequest, socketRefresh]);

    expect(refreshTokenMock).toHaveBeenCalledTimes(1);
    expect(httpResponse.data.authorization).toBe("Bearer new-access-token");
    expect(useUserStore.getState().jwtToken?.accessToken).toBe(
      "new-access-token",
    );
    expect(socket.auth).toEqual({ token: "new-access-token" });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("HTTP 刷新完成后，冷却期内 socket 不再打 RefreshToken", async () => {
    const { http, useUserStore, handleRefreshAndReconnect, socket } =
      await loadAppAssembly();
    const disconnect = vi.spyOn(socket, "disconnect").mockReturnValue(socket);
    const connect = vi.spyOn(socket, "connect").mockReturnValue(socket);
    http.defaults.baseURL = serverUrl;
    useUserStore.getState().setJwtToken({
      accessToken: "old-access-token",
      expiresAt: Date.now() + 60_000,
    });
    refreshTokenMock.mockImplementation(async () => {
      const refreshedToken = {
        accessToken: "new-access-token",
        expiresAt: Date.now() + 60_000,
      };
      useUserStore.getState().setJwtToken(refreshedToken);
      return refreshedToken;
    });

    const httpResponse = await http.get<{ authorization: string }>(
      "/protected/first",
    );
    await handleRefreshAndReconnect();

    expect(refreshTokenMock).toHaveBeenCalledTimes(1);
    expect(httpResponse.data.authorization).toBe("Bearer new-access-token");
    expect(useUserStore.getState().jwtToken?.accessToken).toBe(
      "new-access-token",
    );
    expect(socket.auth).toEqual({ token: "new-access-token" });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
