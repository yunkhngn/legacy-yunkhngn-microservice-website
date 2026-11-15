import { decodeJwtExp, sha256Hex } from './jwt-decode.util';

describe('decodeJwtExp', () => {
  it('returns exp from a well-formed JWT', () => {
    const payload = { exp: 1_800_000_000 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const token = `header.${encoded}.sig`;
    expect(decodeJwtExp(token)).toBe(1_800_000_000);
  });

  it('returns 0 when token has no exp claim', () => {
    const encoded = Buffer.from(JSON.stringify({ sub: 'abc' })).toString(
      'base64url',
    );
    expect(decodeJwtExp(`h.${encoded}.s`)).toBe(0);
  });

  it('returns 0 for malformed token', () => {
    expect(decodeJwtExp('not-a-jwt')).toBe(0);
    expect(decodeJwtExp('')).toBe(0);
    expect(decodeJwtExp('a.b')).toBe(0);
  });
});

describe('sha256Hex', () => {
  it('returns deterministic hex digest', () => {
    expect(sha256Hex('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
});
