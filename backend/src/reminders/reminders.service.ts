import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService, NotificationChannel } from '../notifications/notification.service';
import { ChargesService } from '../charges/charges.service';
import { InstallmentsService } from '../installments/installments.service';
import { ActorContext } from '../common/actor';
import { AuditLogService } from '../audit-log/audit-log.service';
import { interpretReminderReply, planReminders } from './reminder-planner';

export const REMINDERS_QUEUE = 'reminders';
export const SCAN_JOB = 'scan';

@Injectable()
export class RemindersService implements OnModuleInit {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectQueue(REMINDERS_QUEUE) private queue: Queue,
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationService,
    private charges: ChargesService,
    private installments: InstallmentsService,
    private auditLog: AuditLogService,
  ) {}

  /** Agenda o scan diário (cron) assim que a app sobe. Idempotente. */
  async onModuleInit() {
    const pattern = this.config.get<string>('REMINDER_SCAN_CRON', '0 8 * * *');
    const tz = this.config.get<string>('REMINDER_TIMEZONE', 'America/Sao_Paulo');
    try {
      await this.queue.add(
        SCAN_JOB,
        {},
        {
          repeat: { pattern, tz },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      this.logger.log(`Scan de lembretes agendado: "${pattern}" (${tz}).`);
    } catch (err) {
      // Redis fora do ar não deve derrubar a API inteira no MVP.
      this.logger.error(
        `Não foi possível agendar o scan de lembretes (Redis disponível?): ${String(err)}`,
      );
    }
  }

  /**
   * Núcleo do motor: lê todas as recorrências/parcelas, decide o que
   * lembrar hoje (planReminders) e persiste + envia cada lembrete que ainda
   * não existe. A `dedupeKey` única no banco garante idempotência mesmo que
   * o scan rode várias vezes no dia (SEGURANCA.md, seção 5).
   */
  async scanAndSend(now: Date = new Date()) {
    const [charges, installments] = await Promise.all([
      this.prisma.recurringCharge.findMany(),
      this.prisma.installmentPurchase.findMany({ where: { status: 'active' } }),
    ]);

    const planned = planReminders(now, charges, installments);
    let created = 0;

    for (const p of planned) {
      const exists = await this.prisma.reminderLog.findUnique({
        where: { dedupeKey: p.dedupeKey },
      });
      if (exists) continue;

      const delivery = await this.notifications.notifyHousehold(
        p.householdId,
        p.text,
        p.channels as NotificationChannel[],
      );
      const anyOk = delivery.some((d) => d.ok);

      try {
        await this.prisma.reminderLog.create({
          data: {
            householdId: p.householdId,
            chargeId: p.chargeId ?? null,
            installmentPurchaseId: p.installmentPurchaseId ?? null,
            kind: p.kind,
            channels: p.channels.join(','),
            dueDate: p.dueDate,
            dedupeKey: p.dedupeKey,
            status: anyOk ? 'sent' : 'failed',
          },
        });
        created++;
      } catch (err) {
        // Corrida entre dois scans: a unique da dedupeKey resolve, seguimos.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }

    this.logger.log(
      `Scan de lembretes: ${planned.length} previstos, ${created} novos enviados.`,
    );
    return { planned: planned.length, created };
  }

  listForHousehold(householdId: string, take = 50) {
    return this.prisma.reminderLog.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * Resposta a um lembrete `due_day` ("pagou?"). Aceita "sim" / "não" /
   * um valor. "sim" (ou um valor) marca a fatura/parcela como paga usando
   * o mesmo caminho auditado do painel.
   *
   * Via bot (Fase 2) isto roda DEPOIS do PinGuard; aqui, pelo painel, roda
   * atrás de AuthGuard + PermissionsGuard('canMarkPaid').
   */
  async handleReply(reminderLogId: string, rawReply: string, actor: ActorContext) {
    const reminder = await this.prisma.reminderLog.findUnique({
      where: { id: reminderLogId },
    });
    if (!reminder || reminder.householdId !== actor.householdId) {
      throw new NotFoundException('Lembrete não encontrado.');
    }

    const parsed = interpretReminderReply(rawReply);
    let resultingStatus: 'pending' | 'paid' | 'overdue' | null = null;

    if (parsed.intent === 'paid') {
      if (reminder.chargeId) {
        await this.charges.markRecurringChargeAsPaid(reminder.chargeId, actor);
      } else if (reminder.installmentPurchaseId) {
        await this.installments.registerPayment(
          reminder.installmentPurchaseId,
          actor,
        );
      }
      resultingStatus = 'paid';
    } else if (parsed.intent === 'not_paid') {
      resultingStatus = 'pending';
    }

    const updated = await this.prisma.reminderLog.update({
      where: { id: reminderLogId },
      data: {
        status: 'answered',
        responseText: rawReply.slice(0, 280),
        responseStatus: resultingStatus ?? undefined,
        respondedAt: new Date(),
      },
    });

    await this.auditLog.record({
      householdId: actor.householdId,
      userId: actor.userId,
      action: 'reminder.answered',
      entityType: 'ReminderLog',
      entityId: reminderLogId,
      channel: actor.channel,
      summary:
        parsed.intent === 'paid'
          ? 'Respondeu a um lembrete confirmando o pagamento.'
          : parsed.intent === 'not_paid'
            ? 'Respondeu a um lembrete dizendo que ainda não pagou.'
            : 'Respondeu a um lembrete (resposta não reconhecida).',
    });

    return { reminder: updated, interpreted: parsed };
  }
}
