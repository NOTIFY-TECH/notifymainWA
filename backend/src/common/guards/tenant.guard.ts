import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.params.tenantId;
    const user = request.user;

    if (!tenantId || !user) {
      throw new ForbiddenException('Access denied');
    }

    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return true;
  }
}
