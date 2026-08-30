import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [AccountsService, PermissionsGuard],
  controllers: [AccountsController],
  exports: [AccountsService],
})
export class AccountsModule {}
