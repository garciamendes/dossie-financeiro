import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RemindersService, REMINDERS_QUEUE } from './reminders.service';
import { RemindersProcessor } from './reminders.processor';
import { RemindersController } from './reminders.controller';
import { InternalRemindersController } from './internal-reminders.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChargesModule } from '../charges/charges.module';
import { InstallmentsModule } from '../installments/installments.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

/**
 * Dois modos:
 *  - `REMINDERS_QUEUE_ENABLED=true`  → BullMQ + Redis + worker in-process
 *    faz o scan agendado (ideal quando há Redis, ex: Railway).
 *  - qualquer outro valor            → sem Redis; o scan roda via
 *    POST /internal/reminders/scan, chamado por um cron externo grátis
 *    (ideal pra Render free / deploy sem Redis).
 */
export function remindersQueueEnabled(): boolean {
  return process.env.REMINDERS_QUEUE_ENABLED === 'true';
}

@Module({})
export class RemindersModule {
  static register(): DynamicModule {
    const withQueue = remindersQueueEnabled();
    return {
      module: RemindersModule,
      imports: [
        NotificationsModule,
        ChargesModule,
        InstallmentsModule,
        AuditLogModule,
        ...(withQueue
          ? [BullModule.registerQueue({ name: REMINDERS_QUEUE })]
          : []),
      ],
      providers: [
        RemindersService,
        PermissionsGuard,
        ...(withQueue ? [RemindersProcessor] : []),
      ],
      controllers: [RemindersController, InternalRemindersController],
      exports: [RemindersService],
    };
  }
}
