import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ALLOW_DELEGATION_KEY } from '../decorators/allow-delegation.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator — route is accessible to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    // SUPER_ADMIN bypasses all tenant-level role restrictions
    if (user?.role === UserRole.SUPER_ADMIN) return true;

    if (requiredRoles.includes(user?.role)) return true;

    // Owner-away delegation: a TENANT_ADMIN may access a TENANT_OWNER-only
    // route if it's explicitly marked @AllowDelegation() AND the tenant's
    // owner-away window is currently active. Opt-in by design — routes
    // without @AllowDelegation() never honor this, regardless of role.
    if (
      user?.role === UserRole.TENANT_ADMIN &&
      requiredRoles.includes(UserRole.TENANT_OWNER)
    ) {
      const allowsDelegation = this.reflector.getAllAndOverride<boolean>(
        ALLOW_DELEGATION_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (allowsDelegation) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: { ownerAwayUntil: true },
        });

        if (tenant?.ownerAwayUntil && tenant.ownerAwayUntil > new Date()) {
          return true;
        }
      }
    }

    throw new ForbiddenException(
      `This action requires one of: ${requiredRoles.join(', ')}`,
    );
  }
}
