import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditChannel } from '../audit-log/audit-log.service';

const MAX_MEMBERS_PER_HOUSEHOLD = 5;
const INVITE_TTL_HOURS = 24;

interface ActorContext {
  userId: string;
  householdId: string;
  channel: AuditChannel;
}

/**
 * Implementa o fluxo descrito em PRD_sistema_financeiro.md, seção 5:
 * acesso de casal/família sem compartilhar senha. A associação entre
 * pessoas acontece por convite com token de validade curta — nunca por
 * credencial compartilhada.
 */
@Injectable()
export class HouseholdService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async createHouseholdForOwner(ownerUserId: string, name: string) {
    return this.prisma.household.create({
      data: {
        name,
        members: {
          create: {
            userId: ownerUserId,
            role: 'owner',
            // Owner nasce com todas as permissões, incluindo as exclusivas.
            canCreateCharge: true,
            canEditCharge: true,
            canDeleteCharge: true,
            canMarkPaid: true,
            canManageGoals: true,
            canInviteMembers: true,
            canManageMembers: true,
          },
        },
      },
      include: { members: true },
    });
  }

  /** Só quem tem `canInviteMembers` chega aqui (garantido pelo PermissionsGuard na rota). */
  async createInvite(actor: ActorContext, channel?: string) {
    const memberCount = await this.prisma.householdMember.count({
      where: { householdId: actor.householdId },
    });
    const pendingCount = await this.prisma.invite.count({
      where: { householdId: actor.householdId, status: 'pending' },
    });

    if (memberCount + pendingCount >= MAX_MEMBERS_PER_HOUSEHOLD) {
      throw new ForbiddenException(
        `Essa ficha já está no limite de ${MAX_MEMBERS_PER_HOUSEHOLD} pessoas.`,
      );
    }

    const token = crypto.randomBytes(24).toString('hex');
    const invite = await this.prisma.invite.create({
      data: {
        householdId: actor.householdId,
        token,
        channel,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * INVITE_TTL_HOURS),
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'invite.created',
      entityType: 'Invite',
      entityId: invite.id,
      channel: actor.channel,
      summary: `Gerou um convite para entrar na ficha (expira em ${INVITE_TTL_HOURS}h).`,
    });

    return invite;
  }

  /**
   * A pessoa convidada já tem (ou acabou de criar) sua PRÓPRIA conta —
   * em nenhum momento uma senha é digitada ou compartilhada entre as
   * duas pessoas. Aceitar o convite só vincula o userId dela ao Household.
   */
  async acceptInvite(token: string, newMemberUserId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });

    if (!invite) throw new NotFoundException('Convite não encontrado.');
    if (invite.status !== 'pending') {
      throw new ForbiddenException('Esse convite já foi usado, expirou ou foi revogado.');
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.invite.update({ where: { id: invite.id }, data: { status: 'expired' } });
      throw new ForbiddenException('Esse convite expirou.');
    }

    const memberCount = await this.prisma.householdMember.count({
      where: { householdId: invite.householdId },
    });
    if (memberCount >= MAX_MEMBERS_PER_HOUSEHOLD) {
      throw new ForbiddenException('Essa ficha já atingiu o limite de membros.');
    }

    const [member] = await this.prisma.$transaction([
      this.prisma.householdMember.create({
        data: {
          householdId: invite.householdId,
          userId: newMemberUserId,
          role: 'member',
          // Permissões default de um membro convidado — o owner ajusta depois
          // via updateMemberPermissions. Nunca ganha canManageMembers de cara.
          canCreateCharge: true,
          canEditCharge: true,
          canDeleteCharge: false,
          canMarkPaid: true,
          canManageGoals: true,
          canInviteMembers: false,
          canManageMembers: false,
        },
      }),
      this.prisma.invite.update({ where: { id: invite.id }, data: { status: 'accepted' } }),
    ]);

    await this.auditLog.record({
      householdId: invite.householdId,
      userId: newMemberUserId,
      action: 'member.joined',
      entityType: 'HouseholdMember',
      entityId: member.id,
      channel: 'web',
      summary: 'Aceitou o convite e entrou na ficha.',
    });

    return member;
  }

  async revokeInvite(actor: ActorContext, inviteId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.householdId !== actor.householdId) {
      throw new NotFoundException('Convite não encontrado.');
    }

    const updated = await this.prisma.invite.update({
      where: { id: inviteId },
      data: { status: 'revoked' },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'invite.revoked',
      entityType: 'Invite',
      entityId: inviteId,
      channel: actor.channel,
      summary: 'Revogou um convite pendente.',
    });

    return updated;
  }

  /**
   * Só o owner chega aqui (garantido por @RequirePermission('canManageMembers')
   * na rota). Mudança de permissão é, ela mesma, uma ação auditada —
   * decisão explícita do stakeholder em SEGURANCA.md.
   */
  async updateMemberPermissions(
    actor: ActorContext,
    targetMemberId: string,
    changes: Partial<
      Pick<
        import('@prisma/client').HouseholdMember,
        | 'canCreateCharge'
        | 'canEditCharge'
        | 'canDeleteCharge'
        | 'canMarkPaid'
        | 'canManageGoals'
        | 'canInviteMembers'
        | 'canManageMembers'
      >
    >,
  ) {
    const target = await this.prisma.householdMember.findUnique({ where: { id: targetMemberId } });
    if (!target || target.householdId !== actor.householdId) {
      throw new NotFoundException('Membro não encontrado nessa ficha.');
    }
    if (target.role === 'owner') {
      throw new ForbiddenException('Não é possível alterar as permissões do dono da ficha.');
    }

    const updated = await this.prisma.householdMember.update({
      where: { id: targetMemberId },
      data: changes,
    });

    const changedKeys = Object.keys(changes).join(', ');
    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'member.permission_changed',
      entityType: 'HouseholdMember',
      entityId: targetMemberId,
      channel: actor.channel,
      summary: `Alterou permissões do membro (${changedKeys}).`,
    });

    return updated;
  }

  async removeMember(actor: ActorContext, targetMemberId: string) {
    const target = await this.prisma.householdMember.findUnique({ where: { id: targetMemberId } });
    if (!target || target.householdId !== actor.householdId) {
      throw new NotFoundException('Membro não encontrado nessa ficha.');
    }
    if (target.role === 'owner') {
      throw new ForbiddenException('O dono da ficha não pode ser removido.');
    }

    await this.prisma.householdMember.delete({ where: { id: targetMemberId } });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'member.removed',
      entityType: 'HouseholdMember',
      entityId: targetMemberId,
      channel: actor.channel,
      summary: 'Removeu um membro da ficha.',
    });

    return { removed: true };
  }
}
