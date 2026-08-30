import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ActorContext } from '../common/actor';
import {
  CreateTransactionDto,
  ListTransactionsQueryDto,
} from './dto/transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  list(householdId: string, query: ListTransactionsQueryDto) {
    const where: Prisma.TransactionWhereInput = { householdId };
    if (query.category) where.category = query.category;
    if (query.from || query.to) {
      where.occurredAt = {};
      if (query.from) where.occurredAt.gte = new Date(query.from);
      if (query.to) where.occurredAt.lte = new Date(query.to);
    }
    return this.prisma.transaction.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });
  }

  async create(actor: ActorContext, dto: CreateTransactionDto) {
    const tx = await this.prisma.transaction.create({
      data: {
        householdId: actor.householdId,
        amountCents: dto.amountCents,
        description: dto.description ?? null,
        category: dto.category ?? null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        origin: actor.channel === 'web' ? 'manual' : actor.channel,
        createdByUserId: actor.userId,
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'transaction.created',
      entityType: 'Transaction',
      entityId: tx.id,
      channel: actor.channel,
      summary: `Lançou um gasto${dto.category ? ` em ${dto.category}` : ''}.`,
    });

    return tx;
  }

  async remove(actor: ActorContext, transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx || tx.householdId !== actor.householdId) {
      throw new NotFoundException('Lançamento não encontrado.');
    }

    await this.prisma.transaction.delete({ where: { id: transactionId } });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'transaction.deleted',
      entityType: 'Transaction',
      entityId: transactionId,
      channel: actor.channel,
      summary: 'Excluiu um lançamento.',
    });

    return { removed: true };
  }
}
