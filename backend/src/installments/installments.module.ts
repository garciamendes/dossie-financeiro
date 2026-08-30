import { Module } from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { InstallmentsController } from './installments.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [InstallmentsService, PermissionsGuard],
  controllers: [InstallmentsController],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}
