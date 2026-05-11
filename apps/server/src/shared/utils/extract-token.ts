import { AuthSocket } from '@/modules/socket/interface/auth-socket';

export function extractWsToken(client: AuthSocket): string | undefined {
  if (client.handshake.auth?.token) {
    return client.handshake.auth.token;
  }

  const authHeader = client.handshake.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return undefined;
}
