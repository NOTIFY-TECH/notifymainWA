'use client';

import { useState } from 'react';
import {
  useTeam,
  useInviteMember,
  useResendInvite,
  useRevokeInvite,
  useUpdateMemberRole,
  useRemoveMember,
} from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserRole, INVITABLE_ROLES, ROLE_LABELS, TeamMember, PendingInvitation } from '@/types/team';
import { Users, UserPlus, Loader2, Mail, Clock, RefreshCw, Trash2, ShieldCheck, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Partial<Record<UserRole, string>> = {
  TENANT_OWNER: 'bg-[hsl(var(--purple))]/12 text-[hsl(var(--purple))]',
  TENANT_ADMIN: 'bg-[hsl(var(--green))]/12 text-[hsl(var(--green))]',
  MANAGER: 'bg-blue-500/12 text-blue-400',
  AGENT: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  VIEWER: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
};

function RoleBadge({ role }: { role: UserRole }) {
  const color = ROLE_COLORS[role] ?? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteMemberModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('AGENT');
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: invite, isPending } = useInviteMember();

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    try {
      await invite({ email: email.trim(), role });
      setEmail('');
      setRole('AGENT');
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = extractApiError(err);
      setError(msg ?? 'Failed to send invitation. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Email <span className="text-red-400">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Role
            </Label>
            <select
              id="invite-role"
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]"
            >
              {INVITABLE_ROLES.map(r => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {role === 'TENANT_ADMIN' && 'Can manage sessions, campaigns, and team members.'}
              {role === 'AGENT' && 'Can view and reply in the inbox. Cannot manage settings.'}
              {role === 'VIEWER' && 'Read-only access to conversations and analytics.'}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
              <X className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-[hsl(var(--green-dim))] border border-[hsl(var(--green)/0.25)] text-[hsl(var(--green))] hover:bg-[hsl(var(--green)/0.2)] min-w-[110px]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="w-3.5 h-3.5" />
                Send invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Role change dropdown ─────────────────────────────────────────────────────

function RoleSelect({
  currentRole,
  memberId,
  disabled,
}: {
  currentRole: UserRole;
  memberId: string;
  disabled: boolean;
}) {
  const { mutate: updateRole, isPending } = useUpdateMemberRole();

  return (
    <div className="flex items-center gap-1.5">
      {isPending && <Loader2 className="w-3 h-3 animate-spin text-[hsl(var(--muted-foreground))]" />}
      <select
        value={currentRole}
        disabled={disabled || isPending}
        onChange={e => updateRole({ userId: memberId, data: { role: e.target.value as UserRole } })}
        className="h-7 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {INVITABLE_ROLES.map(r => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const currentUser = useAuthStore(s => s.user);
  const { data: team, isLoading } = useTeam();
  const { mutate: resendInvite, isPending: isResending } = useResendInvite();
  const { mutate: revokeInvite, isPending: isRevoking } = useRevokeInvite();
  const { mutate: removeMember } = useRemoveMember();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const isOwner = currentUser?.role === 'TENANT_OWNER';
  const isAdminOrOwner = isOwner || currentUser?.role === 'TENANT_ADMIN';

  const handleRemove = (member: TeamMember) => {
    if (confirm(`Remove ${member.firstName} ${member.lastName} from the team? They will lose access immediately.`)) {
      removeMember(member.id);
    }
  };

  const handleResend = (invitation: PendingInvitation) => {
    setResendingId(invitation.id);
    resendInvite(invitation.id, {
      onSettled: () => setResendingId(null),
    });
  };

  const handleRevoke = (invitation: PendingInvitation) => {
    if (confirm(`Revoke invitation for ${invitation.email}?`)) {
      setRevokingId(invitation.id);
      revokeInvite(invitation.id, {
        onSettled: () => setRevokingId(null),
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--purple))]/12 text-[hsl(var(--purple))]">
            <Users size={16} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-[hsl(var(--foreground))]">Team</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {team ? `${team.members.length} member${team.members.length !== 1 ? 's' : ''}` : '—'}
            </p>
          </div>
        </div>

        {isAdminOrOwner && (
          <Button
            size="sm"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 bg-[hsl(var(--green-dim))] border border-[hsl(var(--green)/0.25)] text-[hsl(var(--green))] hover:bg-[hsl(var(--green)/0.2)]"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite member
          </Button>
        )}
      </div>

      {/* Members table */}
      <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : !team?.members.length ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Users size={32} className="text-[hsl(var(--muted-foreground))] opacity-40" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No team members yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.4]">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Member
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Role
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide hidden sm:table-cell">
                  Last active
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide hidden sm:table-cell">
                  Joined
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {team.members.map((member, idx) => {
                const isCurrentUser = member.id === currentUser?.id;
                const isThisOwner = member.role === 'TENANT_OWNER';
                const canChangeRole = isOwner && !isCurrentUser && !isThisOwner;
                const canRemove = isAdminOrOwner && !isCurrentUser && !isThisOwner;

                return (
                  <tr
                    key={member.id}
                    className={`border-b border-[hsl(var(--border))] last:border-0 ${idx % 2 === 0 ? '' : 'bg-[hsl(var(--muted))/0.2]'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--purple))]/10 text-[hsl(var(--purple))] text-[11px] font-semibold">
                          {member.firstName[0]}
                          {member.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">
                            {member.firstName} {member.lastName}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-[10px] text-[hsl(var(--muted-foreground))] font-normal">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canChangeRole ? (
                        <RoleSelect currentRole={member.role} memberId={member.id} disabled={false} />
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {member.lastLoginAt
                          ? formatDistanceToNow(new Date(member.lastLoginAt), { addSuffix: true })
                          : 'Never'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {format(new Date(member.createdAt), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canRemove && (
                        <button
                          onClick={() => handleRemove(member)}
                          className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending invitations */}
      {!!team?.pendingInvitations.length && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-[hsl(var(--muted-foreground))]" />
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Pending invitations ({team.pendingInvitations.length})
            </p>
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            {team.pendingInvitations.map((inv, idx) => (
              <div
                key={inv.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border))] last:border-0 ${idx % 2 === 0 ? '' : 'bg-[hsl(var(--muted))/0.2]'}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">{inv.email}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      <RoleBadge role={inv.role} />
                      <span className="ml-1.5">
                        · invited by {inv.invitedBy.firstName} {inv.invitedBy.lastName}· expires{' '}
                        {formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })}
                      </span>
                    </p>
                  </div>
                </div>

                {isAdminOrOwner && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleResend(inv)}
                      disabled={isResending && resendingId === inv.id}
                      className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40"
                      title="Resend invitation"
                    >
                      {isResending && resendingId === inv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRevoke(inv)}
                      disabled={isRevoking && revokingId === inv.id}
                      className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                      title="Revoke invitation"
                    >
                      {isRevoking && revokingId === inv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions note */}
      <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.3] px-4 py-3">
        <ShieldCheck size={14} className="text-[hsl(var(--muted-foreground))] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
          <span className="font-medium text-[hsl(var(--foreground))]">Owner</span> can change roles and manage all
          members. <span className="font-medium text-[hsl(var(--foreground))]">Admins</span> can invite and remove
          agents/viewers. Role changes take effect immediately.
        </p>
      </div>

      <InviteMemberModal open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractApiError(err: unknown): string | undefined {
  if (err instanceof Error && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    return typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : undefined;
  }
  return undefined;
}
