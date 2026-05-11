import { useUserStore } from "@/stores/user";
import { io, Socket } from "socket.io-client";
import { RefreshToken } from "./refresh-token";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./socket-event.types";

let isRefreshing = false;

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

const handleRefreshAndReconnect = async (): Promise<void> => {
  if (isRefreshing) return;

  isRefreshing = true;
  try {
    const { accessToken } = await RefreshToken();
    socket.auth = { token: accessToken };
    socket.disconnect();
    socket.connect();
  } catch {
    useUserStore.getState().logout();
  } finally {
    isRefreshing = false;
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
