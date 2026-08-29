import { Module } from '@nestjs/common';
import { ChargesService } from './charges.service';
import { ChargesController } from './charges.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [ChargesService, PermissionsGuard],
  controllers: [ChargesController],
})
export class ChargesModule {}
