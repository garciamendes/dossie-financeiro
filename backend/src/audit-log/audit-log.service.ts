import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditChannel = 'web' | 'whatsapp' | 'telegram';

interface RecordEntryParams {
  householdId: string;
  userId: string;
  action: string; // ex: "charge.marked_paid"
  entityType: string;
  entityId?: string;
  channel: AuditChannel;
  summary: string; // já pronto pra exibir na aba "Atividades" — sem dado sensível cru
}

/**
 * Toda ação sensível do sistema passa por aqui. Isso não é opcional em
 * nenhum service financeiro — é o que vira a timeline em "Atividades"
 * e a trilha de auditoria imutável descrita em SEGURANCA.md, seção 4.
 */
@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async record(params: RecordEntryParams) {
    return this.prisma.auditLog.create({
      data: {
        householdId: params.householdId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        channel: params.channel,
        summary: params.summary,
      },
    });
  }

  async listForHousehold(householdId: string, take = 50) {
    return this.prisma.auditLog.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { id: true, name: true } } },
    });
  }
}
