import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { auditContext, AuditActor } from './audit-context';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const actor: AuditActor = {
      userId: req?.user?.uid ?? req?.user?.id,
      ipAddress: extractIp(req),
      userAgent: req?.headers?.['user-agent'],
    };

    return new Observable((subscriber) => {
      auditContext.run(actor, () => {
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}

function extractIp(req: any) {
  const fwd: unknown = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  const ip: unknown = req?.ip ?? req?.socket?.remoteAddress;
  return typeof ip === 'string' ? ip : undefined;
}
