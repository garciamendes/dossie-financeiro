import { Injectable, NotFoundException } from '@nestjs/common';
import { Account } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../crypto/encryption.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ActorContext } from '../common/actor';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

/** Conta com os campos sensíveis já decifrados e o número mascarado p/ exibição. */
export interface AccountView {
  id: string;
  name: string;
  type: Account['type'];
  institution: string | null;
  balanceCents: number;
  numberMasked: string | null;
  createdAt: Date;
}

@Injectable()
export class AccountsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private auditLog: AuditLogService,
  ) {}

  private toView(account: Account): AccountView {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution,
      balanceCents: this.encryption.decryptInt(account.balanceEnc),
      numberMasked: account.numberLast4 ? `•••• ${account.numberLast4}` : null,
      createdAt: account.createdAt,
    };
  }

  async list(householdId: string): Promise<AccountView[]> {
    const accounts = await this.prisma.account.findMany({
      where: { householdId },
      orderBy: { createdAt: 'asc' },
    });
    return accounts.map((a) => this.toView(a));
  }

  /** Uso interno (dashboard/projeção): soma dos saldos decifrados. */
  async totalBalanceCents(householdId: string): Promise<number> {
    const accounts = await this.prisma.account.findMany({
      where: { householdId },
      select: { balanceEnc: true },
    });
    return accounts.reduce(
      (sum, a) => sum + this.encryption.decryptInt(a.balanceEnc),
      0,
    );
  }

  async create(actor: ActorContext, dto: CreateAccountDto): Promise<AccountView> {
    const account = await this.prisma.account.create({
      data: {
        householdId: actor.householdId,
        name: dto.name,
        type: dto.type,
        institution: dto.institution ?? null,
        balanceEnc: this.encryption.encryptInt(dto.balanceCents ?? 0),
        numberEnc: dto.number ? this.encryption.encrypt(dto.number) : null,
        numberLast4: dto.number ? dto.number.slice(-4) : null,
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'account.created',
      entityType: 'Account',
      entityId: account.id,
      channel: actor.channel,
      summary: `Cadastrou a conta "${account.name}".`,
    });

    return this.toView(account);
  }

  async update(
    actor: ActorContext,
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountView> {
    const existing = await this.getOwned(actor.householdId, accountId);

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        name: dto.name ?? undefined,
        institution: dto.institution ?? undefined,
        balanceEnc:
          dto.balanceCents === undefined
            ? undefined
            : this.encryption.encryptInt(dto.balanceCents),
        numberEnc: dto.number ? this.encryption.encrypt(dto.number) : undefined,
        numberLast4: dto.number ? dto.number.slice(-4) : undefined,
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'account.updated',
      entityType: 'Account',
      entityId: accountId,
      channel: actor.channel,
      summary: `Editou a conta "${existing.name}".`,
    });

    return this.toView(updated);
  }

  async remove(actor: ActorContext, accountId: string) {
    const existing = await this.getOwned(actor.householdId, accountId);

    // Solta os vínculos de faturas antes de excluir (a fatura em si permanece).
    await this.prisma.recurringCharge.updateMany({
      where: { accountId },
      data: { accountId: null },
    });
    await this.prisma.account.delete({ where: { id: accountId } });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'account.deleted',
      entityType: 'Account',
      entityId: accountId,
      channel: actor.channel,
      summary: `Excluiu a conta "${existing.name}".`,
    });

    return { removed: true };
  }

  private async getOwned(householdId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account || account.householdId !== householdId) {
      throw new NotFoundException('Conta não encontrada.');
    }
    return account;
  }
}
