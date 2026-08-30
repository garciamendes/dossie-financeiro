import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [GoalsService, PermissionsGuard],
  controllers: [GoalsController],
  exports: [GoalsService],
})
export class GoalsModule {}
