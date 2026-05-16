import { Test } from '@nestjs/testing';
import { FirebaseStrategy } from './firebase.strategy';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

function makeToken(expSecondsFromNow: number) {
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `h.${payload}.s`;
}

describe('FirebaseStrategy - validation cache', () => {
  let strategy: FirebaseStrategy;
  let cache: { get: jest.Mock; set: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const moduleRef = await Test.createTestingModule({
      providers: [
        FirebaseStrategy,
        {
          provide: ConfigService,
          useValue: { get: () => 'http://auth-service:3002' },
        },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    strategy = moduleRef.get(FirebaseStrategy);
  });

  it('returns cached user on hit and skips auth-service', async () => {
    cache.get.mockResolvedValue({ uid: 'u1', role: 'ADMIN' });
    const user = await strategy.validate(makeToken(600));
    expect(user).toEqual({ uid: 'u1', role: 'ADMIN' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls auth-service on cache miss and stores the result', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ uid: 'u2', role: 'USER' }),
    });
    const user = await strategy.validate(makeToken(600));
    expect(user).toEqual({ uid: 'u2', role: 'USER' });
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:token:/),
      { uid: 'u2', role: 'USER' },
      expect.any(Number),
    );
    const ttl = cache.set.mock.calls[0][2];
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it('does not cache failures', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(strategy.validate(makeToken(600))).rejects.toThrow();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('skips caching when token already expired', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ uid: 'u3' }),
    });
    await strategy.validate(makeToken(-10));
    expect(cache.set).not.toHaveBeenCalled();
  });
});
