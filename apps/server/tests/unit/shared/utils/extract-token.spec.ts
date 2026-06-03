import { describe, expect, it } from 'vitest';
import { AuthSocket } from '@/modules/socket/interface/auth-socket';
import { extractWsToken } from '@/shared/utils/extract-token';

const createClient = ({
  authToken,
  authorization,
}: {
  authToken?: string;
  authorization?: string;
}): AuthSocket => {
  return {
    handshake: {
      auth: authToken ? { token: authToken } : {},
      headers: {
        authorization,
      },
    },
  } as unknown as AuthSocket;
};

describe('extractWsToken', () => {
  it('should read token from socket auth first', () => {
    const token = extractWsToken(
      createClient({
        authToken: 'auth-token',
        authorization: 'Bearer header-token',
      }),
    );

    expect(token).toBe('auth-token');
  });

  it('should read bearer token from authorization header', () => {
    const token = extractWsToken(
      createClient({ authorization: 'Bearer header-token' }),
    );

    expect(token).toBe('header-token');
  });

  it('should ignore unsupported authorization header', () => {
    const token = extractWsToken(
      createClient({ authorization: 'Basic header-token' }),
    );

    expect(token).toBeUndefined();
  });
});
