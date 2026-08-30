import { Injectable } from '@nestjs/common';
import { startOfMonth } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { buildProjection, ProjectionResult } from './projection';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private accounts: AccountsService,
  ) {}

  /** Visão geral do topo do dashboard. */
  async summary(householdId: string) {
    const [
      totalBalanceCents,
      charges,
      installments,
      goals,
      monthSpending,
    ] = await Promise.all([
      this.accounts.totalBalanceCents(householdId),
      this.prisma.recurringCharge.findMany({ where: { householdId } }),
      this.prisma.installmentPurchase.findMany({
        where: { householdId, status: 'active' },
      }),
      this.prisma.goal.findMany({ where: { householdId } }),
      this.spendingByCategory(householdId, startOfMonth(new Date())),
    ]);

    const openCharges = charges.filter((c) => c.status !== 'paid');

    return {
      totalBalanceCents,
      openCharges: {
        count: openCharges.length,
        totalCents: openCharges.reduce((s, c) => s + c.amountCents, 0),
      },
      activeInstallments: {
        count: installments.length,
        remainingCents: installments.reduce(
          (s, i) =>
            s +
            i.installmentAmountCents *
              (i.totalInstallments - i.currentInstallment),
          0,
        ),
      },
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmountCents: g.targetAmountCents,
        currentAmountCents: g.currentAmountCents,
        progress:
          g.targetAmountCents > 0
            ? g.currentAmountCents / g.targetAmountCents
            : 0,
        suggestedMonthlyCents: g.suggestedMonthlyCents,
      })),
      spendingThisMonthByCategory: monthSpending,
    };
  }

  /** "Por onde o dinheiro está indo" — soma de Transactions por categoria. */
  async spendingByCategory(householdId: string, since: Date) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['category'],
      where: { householdId, occurredAt: { gte: since } },
      _sum: { amountCents: true },
    });
    return rows
      .map((r) => ({
        category: r.category ?? 'Sem categoria',
        totalCents: r._sum.amountCents ?? 0,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }

  /** Projeção de fluxo de caixa dos próximos `days` dias. */
  async projection(householdId: string, days = 60): Promise<ProjectionResult> {
    const [startBalanceCents, charges, installments] = await Promise.all([
      this.accounts.totalBalanceCents(householdId),
      this.prisma.recurringCharge.findMany({ where: { householdId } }),
      this.prisma.installmentPurchase.findMany({
        where: { householdId, status: 'active' },
      }),
    ]);

    return buildProjection({
      startBalanceCents,
      horizonDays: days,
      charges: charges.map((c) => ({
        description: c.description,
        amountCents: c.amountCents,
        dueDay: c.dueDay,
        status: c.status,
        lastPaidAt: c.lastPaidAt,
      })),
      installments: installments.map((i) => ({
        description: i.description,
        installmentAmountCents: i.installmentAmountCents,
        totalInstallments: i.totalInstallments,
        currentInstallment: i.currentInstallment,
        nextDueDate: i.nextDueDate,
        status: i.status,
      })),
    });
  }
}
