import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [TransactionsService, PermissionsGuard],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
