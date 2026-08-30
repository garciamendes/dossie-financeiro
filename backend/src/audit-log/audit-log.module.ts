import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  providers: [AuditLogService, PermissionsGuard],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class AuditLogModule {}
