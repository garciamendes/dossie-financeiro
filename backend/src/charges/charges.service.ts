import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditChannel } from '../audit-log/audit-log.service';
import { addMonths } from 'date-fns';

interface ActorContext {
  userId: string;
  householdId: string;
  channel: AuditChannel;
}

@Injectable()
export class ChargesService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  /** Conta/fatura recorrente comum — marcar como paga só reagenda o próximo ciclo. */
  async markRecurringChargeAsPaid(chargeId: string, actor: ActorContext) {
    const charge = await this.prisma.recurringCharge.findUnique({ where: { id: chargeId } });
    if (!charge || charge.householdId !== actor.householdId) {
      throw new NotFoundException('Fatura não encontrada.');
    }

    const updated = await this.prisma.recurringCharge.update({
      where: { id: chargeId },
      data: { status: 'paid' },
    });

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

  /**
   * Regra de transição automática de compra parcelada (PRD_sistema_financeiro.md,
   * seção "Regra de transição automática"):
   *  1. Registra a Transaction da parcela paga.
   *  2. Avança currentInstallment e recalcula nextDueDate (+1 mês).
   *  3. Se bateu o total, marca como "settled" — sai da lista de "em aberto".
   *  4. Tudo isso em uma única transação de banco, e tudo vai pro log.
   */
  async registerInstallmentPayment(purchaseId: string, actor: ActorContext) {
    const purchase = await this.prisma.installmentPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase || purchase.householdId !== actor.householdId) {
      throw new NotFoundException('Compra parcelada não encontrada.');
    }
    if (purchase.status === 'settled') {
      return purchase; // idempotência: já quitada, não faz nada de novo
    }

    const nextInstallment = purchase.currentInstallment + 1;
    const isLast = nextInstallment >= purchase.totalInstallments;

    const [, updatedPurchase] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          householdId: actor.householdId,
          amountCents: purchase.installmentAmountCents,
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
          nextDueDate: isLast ? purchase.nextDueDate : addMonths(purchase.nextDueDate, 1),
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
}
