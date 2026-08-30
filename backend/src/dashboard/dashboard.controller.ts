import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { DashboardService } from './dashboard.service';

/**
 * Só leitura — qualquer membro da ficha pode ver o dashboard (o
 * PermissionsGuard já barra quem não pertence ao household).
 */
@Controller('households/:householdId/dashboard')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('summary')
  summary(@Param('householdId') householdId: string) {
    return this.dashboard.summary(householdId);
  }

  @Get('projection')
  projection(
    @Param('householdId') householdId: string,
    @Query('days', new DefaultValuePipe(60), ParseIntPipe) days: number,
  ) {
    const clamped = Math.min(Math.max(days, 7), 180);
    return this.dashboard.projection(householdId, clamped);
  }
}
