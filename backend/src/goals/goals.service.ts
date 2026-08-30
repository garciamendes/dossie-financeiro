import { Injectable, NotFoundException } from '@nestjs/common';
import { differenceInCalendarMonths } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ActorContext } from '../common/actor';
import { ContributeGoalDto, CreateGoalDto, UpdateGoalDto } from './dto/goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  /**
   * Aporte mensal sugerido pro modo "sonho": o que falta dividido pelos
   * meses até a data-alvo (mínimo 1). Sem data-alvo, não há sugestão.
   * Recalculado a cada mudança de valor/prazo e a cada aporte — se você
   * atrasou, a sugestão sobe sozinha (PRD, Fase 3: "ajustando se você atrasar").
   */
  static suggestMonthly(
    targetCents: number,
    currentCents: number,
    targetDate: Date | null,
    now: Date = new Date(),
  ): number | null {
    if (!targetDate) return null;
    const remaining = Math.max(targetCents - currentCents, 0);
    const months = Math.max(differenceInCalendarMonths(targetDate, now), 1);
    return Math.ceil(remaining / months);
  }

  list(householdId: string) {
    return this.prisma.goal.findMany({
      where: { householdId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(actor: ActorContext, dto: CreateGoalDto) {
    const targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    const current = dto.currentAmountCents ?? 0;

    const goal = await this.prisma.goal.create({
      data: {
        householdId: actor.householdId,
        name: dto.name,
        targetAmountCents: dto.targetAmountCents,
        currentAmountCents: current,
        targetDate,
        suggestedMonthlyCents: GoalsService.suggestMonthly(
          dto.targetAmountCents,
          current,
          targetDate,
        ),
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'goal.created',
      entityType: 'Goal',
      entityId: goal.id,
      channel: actor.channel,
      summary: `Criou a meta "${goal.name}".`,
    });

    return goal;
  }

  async update(actor: ActorContext, goalId: string, dto: UpdateGoalDto) {
    const existing = await this.getOwned(actor.householdId, goalId);
    const targetAmount = dto.targetAmountCents ?? existing.targetAmountCents;
    const targetDate = dto.targetDate
      ? new Date(dto.targetDate)
      : existing.targetDate;

    const updated = await this.prisma.goal.update({
      where: { id: goalId },
      data: {
        name: dto.name ?? undefined,
        targetAmountCents: dto.targetAmountCents ?? undefined,
        targetDate: dto.targetDate ? targetDate : undefined,
        suggestedMonthlyCents: GoalsService.suggestMonthly(
          targetAmount,
          existing.currentAmountCents,
          targetDate,
        ),
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'goal.updated',
      entityType: 'Goal',
      entityId: goalId,
      channel: actor.channel,
      summary: `Editou a meta "${existing.name}".`,
    });

    return updated;
  }

  async contribute(actor: ActorContext, goalId: string, dto: ContributeGoalDto) {
    const existing = await this.getOwned(actor.householdId, goalId);
    const newCurrent = Math.max(existing.currentAmountCents + dto.amountCents, 0);

    const updated = await this.prisma.goal.update({
      where: { id: goalId },
      data: {
        currentAmountCents: newCurrent,
        suggestedMonthlyCents: GoalsService.suggestMonthly(
          existing.targetAmountCents,
          newCurrent,
          existing.targetDate,
        ),
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'goal.contribution',
      entityType: 'Goal',
      entityId: goalId,
      channel: actor.channel,
      summary:
        dto.amountCents >= 0
          ? `Aportou na meta "${existing.name}".`
          : `Corrigiu (para baixo) o valor da meta "${existing.name}".`,
    });

    return updated;
  }

  async remove(actor: ActorContext, goalId: string) {
    const existing = await this.getOwned(actor.householdId, goalId);
    await this.prisma.goal.delete({ where: { id: goalId } });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'goal.deleted',
      entityType: 'Goal',
      entityId: goalId,
      channel: actor.channel,
      summary: `Excluiu a meta "${existing.name}".`,
    });

    return { removed: true };
  }

  private async getOwned(householdId: string, goalId: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.householdId !== householdId) {
      throw new NotFoundException('Meta não encontrada.');
    }
    return goal;
  }
}
