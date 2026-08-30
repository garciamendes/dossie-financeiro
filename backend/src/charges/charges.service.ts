import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ActorContext } from '../common/actor';
import { CreateChargeDto, UpdateChargeDto } from './dto/charge.dto';

@Injectable()
export class ChargesService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  list(householdId: string) {
    return this.prisma.recurringCharge.findMany({
      where: { householdId },
      orderBy: [{ status: 'asc' }, { dueDay: 'asc' }],
    });
  }

  async create(actor: ActorContext, dto: CreateChargeDto) {
    if (dto.accountId) await this.assertAccountInHousehold(actor.householdId, dto.accountId);

    const charge = await this.prisma.recurringCharge.create({
      data: {
        householdId: actor.householdId,
        description: dto.description,
        amountCents: dto.amountCents,
        dueDay: dto.dueDay,
        category: dto.category ?? null,
        accountId: dto.accountId ?? null,
        remindDaysBefore: dto.remindDaysBefore ?? 3,
        remindViaWhatsapp: dto.remindViaWhatsapp ?? true,
        remindViaTelegram: dto.remindViaTelegram ?? true,
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'charge.created',
      entityType: 'RecurringCharge',
      entityId: charge.id,
      channel: actor.channel,
      summary: `Cadastrou a recorrência "${charge.description}" (vence dia ${charge.dueDay}).`,
    });

    return charge;
  }

  async update(actor: ActorContext, chargeId: string, dto: UpdateChargeDto) {
    const existing = await this.getOwned(actor.householdId, chargeId);
    if (dto.accountId) await this.assertAccountInHousehold(actor.householdId, dto.accountId);

    const updated = await this.prisma.recurringCharge.update({
      where: { id: chargeId },
      data: {
        description: dto.description ?? undefined,
        amountCents: dto.amountCents ?? undefined,
        dueDay: dto.dueDay ?? undefined,
        category: dto.category ?? undefined,
        accountId: dto.accountId === undefined ? undefined : dto.accountId,
        remindDaysBefore: dto.remindDaysBefore ?? undefined,
        remindViaWhatsapp: dto.remindViaWhatsapp ?? undefined,
        remindViaTelegram: dto.remindViaTelegram ?? undefined,
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'charge.updated',
      entityType: 'RecurringCharge',
      entityId: chargeId,
      channel: actor.channel,
      summary: `Editou a recorrência "${existing.description}".`,
    });

    return updated;
  }

  async remove(actor: ActorContext, chargeId: string) {
    const existing = await this.getOwned(actor.householdId, chargeId);
    await this.prisma.recurringCharge.delete({ where: { id: chargeId } });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'charge.deleted',
      entityType: 'RecurringCharge',
      entityId: chargeId,
      channel: actor.channel,
      summary: `Excluiu a recorrência "${existing.description}".`,
    });

    return { removed: true };
  }

  /**
   * Marca a recorrência como paga no ciclo atual, registra a Transaction
   * correspondente e reabre para o próximo ciclo (status volta a `pending`
   * — o motor de lembretes cuida de reavisar N dias antes do próximo
   * vencimento). Idempotente dentro do mesmo ciclo.
   */
  async markRecurringChargeAsPaid(chargeId: string, actor: ActorContext) {
    const charge = await this.getOwned(actor.householdId, chargeId);

    const now = new Date();
    const alreadyPaidThisCycle =
      charge.status === 'paid' &&
      charge.lastPaidAt != null &&
      charge.lastPaidAt.getUTCFullYear() === now.getUTCFullYear() &&
      charge.lastPaidAt.getUTCMonth() === now.getUTCMonth();
    if (alreadyPaidThisCycle) return charge;

    const [, updated] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          householdId: actor.householdId,
          description: charge.description,
          amountCents: charge.amountCents,
          category: charge.category,
          origin: actor.channel === 'web' ? 'manual' : actor.channel,
          createdByUserId: actor.userId,
        },
      }),
      this.prisma.recurringCharge.update({
        where: { id: chargeId },
        data: { status: 'paid', lastPaidAt: now },
      }),
    ]);

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'charge.marked_paid',
      entityType: 'RecurringCharge',
      entityId: chargeId,
      channel: actor.channel,
      summary: `Marcou "${charge.description}" como paga.`,
    });

    return updated;
  }

  private async getOwned(householdId: string, chargeId: string) {
    const charge = await this.prisma.recurringCharge.findUnique({
      where: { id: chargeId },
    });
    if (!charge || charge.householdId !== householdId) {
      throw new NotFoundException('Fatura não encontrada.');
    }
    return charge;
  }

  private async assertAccountInHousehold(householdId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account || account.householdId !== householdId) {
      throw new BadRequestException('Conta informada não pertence a essa ficha.');
    }
  }
}
