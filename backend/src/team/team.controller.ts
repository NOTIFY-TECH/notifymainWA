import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { TeamService } from './team.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateMemberManagerDto } from './dto/update-member-manager.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

// Same TTL/cookie options as AuthController.setRefreshCookie — kept in sync
// manually for now. If this drifts from auth.controller.ts, extract both into
// a shared common/utils/cookie.util.ts.
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Team')
@Controller()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // ── Authenticated team routes, scoped to tenant ──────────────────────────

  // GET /tenants/:tenantId/team
  // Session 26: restricted to Owner/Admin — Agents no longer need (or
  // should have) visibility into the team roster.
  @Get('tenants/:tenantId/team')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List team members and pending invitations — owner/admin only',
  })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  listMembers(@Param('tenantId') tenantId: string) {
    return this.teamService.listMembers(tenantId);
  }

  // POST /tenants/:tenantId/team/invite
  @Post('tenants/:tenantId/team/invite')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a new team member by email' })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  inviteMember(
    @Param('tenantId') tenantId: string,
    @Body() dto: InviteMemberDto,
    @Req() req: any,
  ) {
    return this.teamService.inviteMember(tenantId, req.user.userId, dto);
  }

  // POST /tenants/:tenantId/team/invite/:invitationId/resend
  @Post('tenants/:tenantId/team/invite/:invitationId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend a pending invitation with a fresh token' })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  resendInvite(
    @Param('tenantId') tenantId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.teamService.resendInvite(tenantId, invitationId);
  }

  // DELETE /tenants/:tenantId/team/invite/:invitationId
  @Delete('tenants/:tenantId/team/invite/:invitationId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  revokeInvite(
    @Param('tenantId') tenantId: string,
    @Param('invitationId') invitationId: string,
    @Req() req: any,
  ) {
    return this.teamService.revokeInvite(
      tenantId,
      invitationId,
      req.user.userId,
    );
  }

  // PATCH /tenants/:tenantId/team/:userId/role
  @Patch('tenants/:tenantId/team/:userId/role')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change a team member's role — owner only" })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER)
  updateMemberRole(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: any,
  ) {
    return this.teamService.updateMemberRole(
      tenantId,
      req.user.userId,
      userId,
      dto,
    );
  }

  // GET /tenants/:tenantId/team/my-agents/performance
  // NEW (RBAC hierarchy feature) — Manager-only. Auto-scoped to the caller's
  // own team via req.user.userId — there is no tenantId+managerId param
  // combination that lets a Manager view another Manager's team through
  // this route; the service only ever queries managerId = caller.
  //
  // Declared BEFORE ':userId/role' and ':userId/manager' below would not
  // conflict here since 'my-agents' sits under a different path segment
  // ('team/my-agents/performance' vs 'team/:userId/...'), but kept grouped
  // with the other team-roster routes for readability.
  @Get('tenants/:tenantId/team/my-agents/performance')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Per-agent performance stats for the caller's own team — manager only",
  })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.MANAGER)
  getMyAgentsPerformance(@Param('tenantId') tenantId: string, @Req() req: any) {
    return this.teamService.getMyAgentsPerformance(tenantId, req.user.userId);
  }

  // PATCH /tenants/:tenantId/team/:userId/manager
  // NEW (RBAC hierarchy feature) — assign/change/clear which Manager an
  // Agent reports to. Owner/Admin only — Managers cannot reassign their own
  // team via this route (matches @Roles list on .../role above, but
  // deliberately includes TENANT_ADMIN here since this isn't a destructive
  // ownership-transfer action like role changes are restricted to owner-only).
  @Patch('tenants/:tenantId/team/:userId/manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Assign, change, or clear an agent's manager — owner/admin only",
  })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  updateMemberManager(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberManagerDto,
    @Req() req: any,
  ) {
    return this.teamService.setMemberManager(
      tenantId,
      req.user.userId,
      userId,
      dto,
    );
  }

  // DELETE /tenants/:tenantId/team/:userId
  @Delete('tenants/:tenantId/team/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a team member (soft delete)' })
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  removeMember(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.teamService.removeMember(tenantId, req.user.userId, userId);
  }

  // ── Public invite routes — no JWT, the invite token IS the auth ──────────

  // GET /invitations/:token
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Validate an invite token (public)' })
  validateToken(@Param('token') token: string) {
    return this.teamService.validateToken(token);
  }

  // POST /invitations/:token/accept
  //
  // Mirrors AuthController's login/signup/refresh pattern exactly: the
  // refresh token is set as an httpOnly cookie here, then stripped from the
  // JSON body before it's returned. Previously this route had no @Res()
  // parameter at all and TeamService.acceptInvite returned refreshToken
  // directly in the body — meaning no refresh_token cookie was ever set for
  // newly-invited users, and they'd be silently logged out the first time
  // their access token expired (~15 min) because POST /auth/refresh would
  // find no cookie. Fixed here.
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept an invitation and create the account (public)',
  })
  async acceptInvite(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.teamService.acceptInvite(token, dto);

    this.setRefreshCookie(res, result.data.refreshToken);

    const { refreshToken: _refreshToken, ...rest } = result.data;
    return { data: rest };
  }

  // Same cookie options as AuthController.setRefreshCookie. Keep these two
  // in sync manually until they're extracted into a shared util.
  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_TTL_MS,
      path: '/',
    });
  }
}
