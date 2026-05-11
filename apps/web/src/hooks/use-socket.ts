import {
  joinRoom as emitJoinRoom,
  leaveRoom as emitLeaveRoom,
  socket,
} from "@/services/api/socket-client";
import type {
  AckResponse,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/services/api/socket-event.types";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

interface UseSocketReturn {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  isConnected: boolean;
  emit: <K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ) => Promise<AckResponse>;
  on: <K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K],
  ) => void;
  off: <K extends keyof ServerToClientEvents>(
    event: K,
    listener?: ServerToClientEvents[K],
  ) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

export const useSocket = (): UseSocketReturn => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const joinedRoomsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      setIsConnected(true);
      for (const room of joinedRoomsRef.current) {
        emitJoinRoom(room);
      }
    };
    const handleDisconnect = () => setIsConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  const emit = <K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): Promise<AckResponse> => {
    // Socket.IO 的 emit 类型重载与泛型不完全兼容，此处断言是安全的
    return (socket.emitWithAck as Function)(event, ...args);
  };

  const on = <K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K],
  ) => {
    // Socket.IO 的 on/off 类型重载包含内置事件（connect/disconnect 等），
    // 与自定义事件的泛型约束不完全匹配，此处断言是安全的
    (socket.on as Function)(event, listener);
  };

  const off = <K extends keyof ServerToClientEvents>(
    event: K,
    listener?: ServerToClientEvents[K],
  ) => {
    if (listener) {
      (socket.off as Function)(event, listener);
    } else {
      socket.off(event);
    }
  };

  const joinRoom = (room: string) => {
    joinedRoomsRef.current.add(room);
    emitJoinRoom(room);
  };

  const leaveRoom = (room: string) => {
    joinedRoomsRef.current.delete(room);
    emitLeaveRoom(room);
  };

  return {
    socket,
    isConnected,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
  };
};
