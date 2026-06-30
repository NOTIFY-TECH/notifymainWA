import { SetMetadata } from '@nestjs/common';

export const ALLOW_DELEGATION_KEY = 'allowDelegation';

/**
 * Stack on top of @Roles(UserRole.TENANT_OWNER) to permit a TENANT_ADMIN
 * to access this route while the tenant's owner-away delegation window
 * is active (Tenant.ownerAwayUntil is set and in the future).
 *
 * Opt-in by design: routes are NOT delegable unless explicitly marked.
 * This keeps destructive/identity-level Owner actions (e.g. deleting the
 * tenant, removing the Owner's own account) safe by default — they simply
 * never get this decorator.
 */
export const AllowDelegation = () => SetMetadata(ALLOW_DELEGATION_KEY, true);
