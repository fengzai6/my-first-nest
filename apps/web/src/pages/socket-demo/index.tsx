import { useSocket } from "@/hooks/use-socket";
import { useUserStore } from "@/stores/user";
import { Badge, Button, Card, Input, Space, Tag, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";

interface LogItem {
  id: number;
  type: string;
  message: string;
  timestamp: string;
}

export const SocketDemo = () => {
  const user = useUserStore((state) => state.user);
  const { isConnected, emit, on, off, joinRoom, leaveRoom } =
    useSocket();

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [roomName, setRoomName] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [directMessage, setDirectMessage] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: string, message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: ++logIdRef.current,
        type,
        message,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (!logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    on("connected", (data) => {
      addLog("system", `${data.message} (userId: ${data.userId})`);
    });

    on("user-joined", (data) => {
      addLog("system", `${data.displayName} joined`);
    });

    on("user-left", (data) => {
      addLog("system", `${data.username} left`);
    });

    on("room-joined", (data) => {
      addLog("room", `Joined room: ${data.room}`);
      setJoinedRoom(data.room);
    });

    on("room-left", (data) => {
      addLog("room", `Left room: ${data.room}`);
      setJoinedRoom((prev) => (prev === data.room ? "" : prev));
    });

    on("room-user-joined", (data) => {
      addLog("room", `${data.username} joined room ${data.room}`);
    });

    on("room-user-left", (data) => {
      addLog("room", `${data.username} left room ${data.room}`);
    });

    on("room-message", (data) => {
      addLog(
        "room-msg",
        `[${data.room}] ${data.senderDisplayName}: ${data.message}`,
      );
    });

    on("direct-message", (data) => {
      addLog("direct", `${data.senderDisplayName}: ${data.message}`);
    });

    on("broadcast-message", (data) => {
      addLog("broadcast", `${data.senderDisplayName}: ${data.message}`);
    });

    on("exception", (data) => {
      addLog("error", `[${data.status}] ${data.message}`);
    });

    return () => {
      off("connected");
      off("user-joined");
      off("user-left");
      off("room-joined");
      off("room-left");
      off("room-user-joined");
      off("room-user-left");
      off("room-message");
      off("direct-message");
      off("broadcast-message");
      off("exception");
    };
  }, [on, off, addLog]);

  const handleJoinRoom = () => {
    if (!roomName.trim()) return;
    joinRoom(roomName.trim());
  };

  const handleLeaveRoom = () => {
    if (!joinedRoom) return;
    leaveRoom(joinedRoom);
  };

  const handleSendToRoom = async () => {
    if (!joinedRoom || !roomMessage.trim()) return;
    const ack = await emit("send-to-room", {
      room: joinedRoom,
      message: roomMessage.trim(),
    });
    if (ack.success) {
      addLog("room-sent", `[${joinedRoom}] Me: ${roomMessage.trim()}`);
    } else {
      addLog("error", `Send failed: ${ack.message}`);
    }
    setRoomMessage("");
  };

  const handleSendToUser = async () => {
    if (!targetUserId.trim() || !directMessage.trim()) return;
    const ack = await emit("send-to-user", {
      targetUserId: targetUserId.trim(),
      message: directMessage.trim(),
    });
    if (ack.success) {
      addLog("direct-sent", `To ${targetUserId.trim()}: ${directMessage.trim()}`);
    } else {
      addLog("error", `Send failed: ${ack.message}`);
    }
    setDirectMessage("");
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    const ack = await emit("broadcast", {
      message: broadcastMessage.trim(),
    });
    if (ack.success) {
      addLog("broadcast-sent", `Broadcast sent: ${broadcastMessage.trim()}`);
    } else {
      addLog("error", `Broadcast failed: ${ack.message}`);
    }
    setBroadcastMessage("");
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case "system":
        return "blue";
      case "room":
        return "cyan";
      case "room-msg":
        return "green";
      case "room-sent":
        return "lime";
      case "direct":
        return "orange";
      case "direct-sent":
        return "gold";
      case "broadcast":
        return "purple";
      case "broadcast-sent":
        return "magenta";
      case "error":
        return "red";
      default:
        return "default";
    }
  };

  return (
    <div className="flex-1 space-y-4 overflow-auto p-6">
      <Typography.Title level={3}>Socket.IO Demo</Typography.Title>

      {/* 连接状态 */}
      <Card size="small">
        <Space>
          <span>Status:</span>
          <Badge
            status={isConnected ? "success" : "error"}
            text={isConnected ? "Connected" : "Disconnected"}
          />
          <Tag>User: {user.username}</Tag>
          <Tag>ID: {user.id}</Tag>
        </Space>
      </Card>

      {/* Room 管理 */}
      <Card title="Room Management" size="small">
        <Space direction="vertical" className="w-full">
          <Space>
            <Input
              placeholder="Room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onPressEnter={handleJoinRoom}
              disabled={!isConnected}
            />
            <Button
              type="primary"
              onClick={handleJoinRoom}
              disabled={!isConnected}
            >
              Join Room
            </Button>
            <Button
              onClick={handleLeaveRoom}
              disabled={!isConnected || !joinedRoom}
            >
              Leave Room
            </Button>
            {joinedRoom && <Tag color="blue">Current: {joinedRoom}</Tag>}
          </Space>
        </Space>
      </Card>

      {/* 发送到 Room */}
      <Card title="Send to Room" size="small">
        <Space>
          <Input
            placeholder="Message"
            value={roomMessage}
            onChange={(e) => setRoomMessage(e.target.value)}
            onPressEnter={handleSendToRoom}
            disabled={!isConnected || !joinedRoom}
            style={{ width: 300 }}
          />
          <Button
            type="primary"
            onClick={handleSendToRoom}
            disabled={!isConnected || !joinedRoom}
          >
            Send to Room
          </Button>
        </Space>
      </Card>

      {/* 发送给指定用户 */}
      <Card title="Send to User" size="small">
        <Space>
          <Input
            placeholder="Target User ID"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            disabled={!isConnected}
            style={{ width: 200 }}
          />
          <Input
            placeholder="Message"
            value={directMessage}
            onChange={(e) => setDirectMessage(e.target.value)}
            onPressEnter={handleSendToUser}
            disabled={!isConnected}
            style={{ width: 200 }}
          />
          <Button
            type="primary"
            onClick={handleSendToUser}
            disabled={!isConnected}
          >
            Send to User
          </Button>
        </Space>
      </Card>

      {/* 广播 */}
      <Card title="Broadcast (except self)" size="small">
        <Space>
          <Input
            placeholder="Broadcast message"
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            onPressEnter={handleBroadcast}
            disabled={!isConnected}
            style={{ width: 300 }}
          />
          <Button
            type="primary"
            onClick={handleBroadcast}
            disabled={!isConnected}
          >
            Broadcast
          </Button>
        </Space>
      </Card>

      {/* 消息日志 */}
      <Card
        title="Message Log"
        size="small"
        extra={
          <Button size="small" onClick={() => setLogs([])}>
            Clear
          </Button>
        }
      >
        <div
          ref={logContainerRef}
          className="h-80 overflow-auto rounded border bg-gray-50 p-2 font-mono text-xs"
        >
          {logs.length === 0 ? (
            <div className="py-4 text-center text-gray-400">
              No messages yet
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="py-0.5">
                <span className="text-gray-400">{log.timestamp}</span>{" "}
                <Tag color={getLogColor(log.type)} className="mr-1">
                  {log.type}
                </Tag>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
