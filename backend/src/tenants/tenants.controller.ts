import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AllowDelegation } from '../common/decorators/allow-delegation.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  // FIXED (10D, session 8): this route had NO guards at all — any
  // unauthenticated request could create a tenant. Restricted to
  // SUPER_ADMIN pending confirmation from the project owner that this
  // route is still actually used anywhere (it may be dead code now that
  // AuthService.signup() creates a tenant inline — see master doc section
  // 8E). Confirmed via a frontend-wide grep that nothing in the frontend
  // calls this route, so this guard should not break anything observable
  // from the app itself.
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a tenant directly (platform-admin only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  // NEW (10D, session 8) — public, no guard. Must be declared BEFORE
  // the ':tenantId' GET route below, or Nest will match 'verify-email'
  // as a :tenantId value and this route will never be reached.
  // Token is the auth, same trust model as the Invitation accept flow.
  @Get('verify-email')
  @ApiOperation({
    summary: 'Confirm a pending tenant email change (public, token-authed)',
  })
  verifyEmail(@Query('token') token: string) {
    return this.tenantsService.verifyEmail(token);
  }

  // FIXED (10D, session 8): this route also had NO guards — any
  // unauthenticated request could fetch ANY tenant's full record by ID,
  // including razorpayCustomerId, plan, and usage limits.
  //
  // Route param renamed from :id to :tenantId — TenantGuard reads
  // request.params.tenantId literally (confirmed by reading the guard's
  // source); with the old :id param name, tenantId would always have been
  // undefined and every request would have hit the guard's `!tenantId`
  // check and thrown ForbiddenException unconditionally. Confirmed via a
  // frontend-wide grep that nothing calls this route with a positional
  // path segment that would be broken by the rename (no frontend caller
  // exists for this route at all yet).
  @Get(':tenantId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  findOne(@Param('tenantId') tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }

  // NEW (10D, session 8) — tenant profile editing, first piece of Settings.
  // Owner-only: name/email are the only self-service fields; plan and
  // usage limits are billing/admin-controlled, not exposed here. An email
  // change does not take effect immediately — see TenantsService.updateProfile.
  //
  // UPDATED (RBAC hierarchy feature) — @AllowDelegation() added. This is a
  // company-profile route, which falls under "no one but Owner / Admin-while-
  // elevated touches company profile". A TENANT_ADMIN can now reach this
  // route ONLY while the tenant's owner-away window is active (see RolesGuard).
  @Patch(':tenantId')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update tenant profile (name/email) — owner only, or admin during owner-away',
  })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER)
  @AllowDelegation()
  updateProfile(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.updateProfile(tenantId, dto);
  }

  // NEW (10D, session 8) — re-send the pending email-change verification
  // link with a fresh token/expiry. Owner-only, same guard stack as
  // updateProfile. Mirrors TeamController's resend-invite route shape.
  @Post(':tenantId/resend-verification')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resend pending email verification link — owner only',
  })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER)
  resendVerification(@Param('tenantId') tenantId: string) {
    return this.tenantsService.resendVerification(tenantId);
  }

  // NEW (RBAC hierarchy feature) — Owner marks themselves away. Strictly
  // TENANT_OWNER — no @AllowDelegation() here, since this route itself is
  // what GRANTS delegation. An already-elevated Admin must not be able to
  // re-trigger/extend their own elevation by calling this.
  @Post(':tenantId/owner-away')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Mark Owner as away, temporarily delegating Owner-gated actions to Admin — owner only',
  })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER)
  ownerAway(@Param('tenantId') tenantId: string) {
    return this.tenantsService.ownerAway(tenantId);
  }

  // NEW (RBAC hierarchy feature) — ends delegation early. Strictly
  // TENANT_OWNER per project decision: Admin cannot self-deescalate their
  // own elevated access, only the Owner can end it.
  @Post(':tenantId/owner-away/cancel')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel an active owner-away delegation window — owner only',
  })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER)
  cancelOwnerAway(@Param('tenantId') tenantId: string) {
    return this.tenantsService.cancelOwnerAway(tenantId);
  }
}
