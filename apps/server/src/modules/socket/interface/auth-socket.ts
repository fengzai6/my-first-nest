import { User } from '@/modules/users/entities/user.entity';
import { Socket } from 'socket.io';

export interface AuthSocket extends Socket {
  user?: User;
  handshake: Socket['handshake'] & {
    auth: { token?: string };
  };
}
