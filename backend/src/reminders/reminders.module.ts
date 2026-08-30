import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RemindersService, REMINDERS_QUEUE } from './reminders.service';
import { RemindersProcessor } from './reminders.processor';
import { RemindersController } from './reminders.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChargesModule } from '../charges/charges.module';
import { InstallmentsModule } from '../installments/installments.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: REMINDERS_QUEUE }),
    NotificationsModule,
    ChargesModule,
    InstallmentsModule,
    AuditLogModule,
  ],
  providers: [RemindersService, RemindersProcessor, PermissionsGuard],
  controllers: [RemindersController],
  exports: [RemindersService],
})
export class RemindersModule {}
