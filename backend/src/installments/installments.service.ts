import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addMonths } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ActorContext } from '../common/actor';
import { CreateInstallmentDto } from './dto/installment.dto';

@Injectable()
export class InstallmentsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  list(householdId: string) {
    return this.prisma.installmentPurchase.findMany({
      where: { householdId },
      orderBy: [{ status: 'asc' }, { nextDueDate: 'asc' }],
    });
  }

  async create(actor: ActorContext, dto: CreateInstallmentDto) {
    const current = dto.currentInstallment ?? 0;
    if (current >= dto.totalInstallments) {
      throw new BadRequestException(
        'Parcelas já pagas não podem ser maior ou igual ao total.',
      );
    }

    const purchase = await this.prisma.installmentPurchase.create({
      data: {
        householdId: actor.householdId,
        description: dto.description,
        installmentAmountCents: dto.installmentAmountCents,
        totalInstallments: dto.totalInstallments,
        currentInstallment: current,
        nextDueDate: new Date(dto.nextDueDate),
        category: dto.category ?? null,
        remindDaysBefore: dto.remindDaysBefore ?? 3,
        remindViaWhatsapp: dto.remindViaWhatsapp ?? true,
        remindViaTelegram: dto.remindViaTelegram ?? true,
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'installment.created',
      entityType: 'InstallmentPurchase',
      entityId: purchase.id,
      channel: actor.channel,
      summary: `Cadastrou a compra parcelada "${purchase.description}" (${current}/${dto.totalInstallments} já pagas).`,
    });

    return purchase;
  }

  /**
   * Regra de transição automática de compra parcelada
   * (PRD_sistema_financeiro.md, seção "Regra de transição automática"):
   *  1. Registra a Transaction da parcela paga.
   *  2. Avança currentInstallment e recalcula nextDueDate (+1 mês).
   *  3. Se bateu o total, marca como "settled" — sai da lista de "em aberto".
   *  4. Tudo em uma única transação de banco, e tudo vai pro log.
   * O reagendamento do próximo lembrete é automático: o scan diário do
   * motor de lembretes passa a enxergar o novo nextDueDate.
   */
  async registerPayment(purchaseId: string, actor: ActorContext) {
    const purchase = await this.getOwned(actor.householdId, purchaseId);
    if (purchase.status === 'settled') {
      return purchase; // idempotência: já quitada, não faz nada de novo
    }

    const nextInstallment = purchase.currentInstallment + 1;
    const isLast = nextInstallment >= purchase.totalInstallments;

    const [, updatedPurchase] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          householdId: actor.householdId,
          description: `Parcela ${nextInstallment}/${purchase.totalInstallments} — ${purchase.description}`,
          amountCents: purchase.installmentAmountCents,
          category: purchase.category,
          origin: actor.channel === 'web' ? 'manual' : actor.channel,
          installmentPurchaseId: purchase.id,
          createdByUserId: actor.userId,
        },
      }),
      this.prisma.installmentPurchase.update({
        where: { id: purchase.id },
        data: {
          currentInstallment: nextInstallment,
          status: isLast ? 'settled' : 'active',
          nextDueDate: isLast
            ? purchase.nextDueDate
            : addMonths(purchase.nextDueDate, 1),
        },
      }),
    ]);

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: isLast ? 'installment.settled' : 'installment.payment_registered',
      entityType: 'InstallmentPurchase',
      entityId: purchase.id,
      channel: actor.channel,
      summary: isLast
        ? `Quitou a compra "${purchase.description}" (última parcela ${purchase.totalInstallments}/${purchase.totalInstallments}).`
        : `Registrou a parcela ${nextInstallment}/${purchase.totalInstallments} de "${purchase.description}".`,
    });

    return updatedPurchase;
  }

  private async getOwned(householdId: string, purchaseId: string) {
    const purchase = await this.prisma.installmentPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase || purchase.householdId !== householdId) {
      throw new NotFoundException('Compra parcelada não encontrada.');
    }
    return purchase;
  }
}
