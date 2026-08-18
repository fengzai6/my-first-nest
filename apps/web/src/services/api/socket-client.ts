import { useUserStore } from "@/stores/user";
import { io, Socket } from "socket.io-client";
import { RefreshToken } from "./refresh-token";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./socket-event.types";
import { tokenRefreshManager } from "./token-refresh-manager";

const SOCKET_REFRESH_OWNER = Symbol("socket-refresh-owner");

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  "/socket",
  {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    transports: ["websocket", "polling"],
    auth: (cb) => {
      const token = useUserStore.getState().jwtToken?.accessToken;
      cb({ token });
    },
  },
);

export const joinRoom = (room: string): void => {
  socket.emit("join-room", { room });
};

export const leaveRoom = (room: string): void => {
  socket.emit("leave-room", { room });
};

const resolveAccessToken = (result: unknown): string | undefined => {
  if (typeof result === "string" && result) {
    return result;
  }

  if (result && typeof result === "object" && "token" in result) {
    const token = (result as { token?: unknown }).token;
    if (typeof token === "string" && token) {
      return token;
    }
  }

  return useUserStore.getState().jwtToken?.accessToken;
};

export const handleRefreshAndReconnect = async (): Promise<void> => {
  try {
    const result = await tokenRefreshManager.runRefresh(async () => {
      const { accessToken, expiresAt } = await RefreshToken();

      return {
        token: accessToken,
        expiresAt,
      };
    }, SOCKET_REFRESH_OWNER);

    const accessToken = resolveAccessToken(result);
    if (!accessToken) {
      useUserStore.getState().logout();
      return;
    }

    socket.auth = { token: accessToken };
    socket.disconnect();
    socket.connect();
  } catch {
    useUserStore.getState().logout();
  }
};

// 连接中 guard 抛出的 401
socket.on("exception", (error) => {
  if (error.status === 401) {
    handleRefreshAndReconnect();
  }
});

// 连接建立时 handleConnection 中的 401（server 主动 disconnect）
socket.io.on("error", (error) => {
  if (typeof error === "object" && error !== null && "status" in error) {
    if ((error as { status?: number }).status === 401) {
      handleRefreshAndReconnect();
    }
  }
});
