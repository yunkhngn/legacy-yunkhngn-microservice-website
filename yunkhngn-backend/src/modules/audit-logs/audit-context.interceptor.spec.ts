import { of } from 'rxjs';
import { AuditContextInterceptor } from './audit-context.interceptor';
import { getAuditActor } from './audit-context';

function makeContext(user: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        headers: {
          'user-agent': 'jest',
          'x-forwarded-for': '203.0.113.10, 10.0.0.1',
        },
      }),
    }),
  } as any;
}

describe('AuditContextInterceptor', () => {
  it('stores actor email when available', (done) => {
    const interceptor = new AuditContextInterceptor();

    interceptor
      .intercept(makeContext({ uid: 'firebase-uid', email: 'admin@example.com' }), {
        handle: () =>
          of(null).pipe((source) => {
            expect(getAuditActor()).toEqual({
              userId: 'admin@example.com',
              ipAddress: '203.0.113.10',
              userAgent: 'jest',
            });
            return source;
          }),
      } as any)
      .subscribe({ complete: done });
  });

  it('falls back to uid when email is unavailable', (done) => {
    const interceptor = new AuditContextInterceptor();

    interceptor
      .intercept(makeContext({ uid: 'firebase-uid' }), {
        handle: () =>
          of(null).pipe((source) => {
            expect(getAuditActor().userId).toBe('firebase-uid');
            return source;
          }),
      } as any)
      .subscribe({ complete: done });
  });
});
