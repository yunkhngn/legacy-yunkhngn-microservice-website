import { createHash } from 'crypto';

export function decodeJwtExp(token: string): number {
  if (!token || typeof token !== 'string') return 0;
  const parts = token.split('.');
  if (parts.length !== 3) return 0;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    );
    const exp = payload?.exp;
    return typeof exp === 'number' ? exp : 0;
  } catch {
    return 0;
  }
}

export function sha256Hex(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}
