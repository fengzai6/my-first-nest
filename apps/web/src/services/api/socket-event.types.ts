export interface ServerToClientEvents {
  connected: (data: {
    message: string;
    userId: string;
    username: string;
  }) => void;
  'user-joined': (data: {
    userId: string;
    username: string;
    displayName: string;
  }) => void;
  'user-left': (data: { userId: string; username: string }) => void;
  'room-joined': (data: { room: string }) => void;
  'room-left': (data: { room: string }) => void;
  'room-user-joined': (data: {
    room: string;
    userId: string;
    username: string;
  }) => void;
  'room-user-left': (data: {
    room: string;
    userId: string;
    username: string;
  }) => void;
  'room-message': (data: {
    room: string;
    message: string;
    senderId: string;
    senderUsername: string;
    senderDisplayName: string;
    timestamp: string;
  }) => void;
  'direct-message': (data: {
    message: string;
    senderId: string;
    senderUsername: string;
    senderDisplayName: string;
    timestamp: string;
  }) => void;
  'broadcast-message': (data: {
    message: string;
    senderId: string;
    senderUsername: string;
    senderDisplayName: string;
    timestamp: string;
  }) => void;
  error: (data: { message: string }) => void;
  exception: (data: { status: number; message: string }) => void;
}

export interface ClientToServerEvents {
  'join-room': (data: { room: string }) => void;
  'leave-room': (data: { room: string }) => void;
  'send-to-room': (data: { room: string; message: string }) => void;
  'send-to-user': (data: { targetUserId: string; message: string }) => void;
  broadcast: (data: { message: string }) => void;
}

export interface AckResponse {
  success: boolean;
  message?: string;
}
