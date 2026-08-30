import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  providers: [DashboardService, PermissionsGuard],
  controllers: [DashboardController],
})
export class DashboardModule {}
