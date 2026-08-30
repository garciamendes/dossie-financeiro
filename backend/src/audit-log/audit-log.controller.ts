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
import { AuditLogService } from './audit-log.service';

/**
 * Aba "Atividades" do produto (PRD seção 5 / SEGURANCA.md seção 4):
 * qualquer membro do household vê o histórico de ações de todos, inclusive
 * as próprias. Transparência entre as duas pessoas É a funcionalidade de
 * segurança aqui — por isso é tela, não só log técnico.
 */
@Controller('households/:householdId/activity')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class AuditLogController {
  constructor(private auditLog: AuditLogService) {}

  @Get()
  list(
    @Param('householdId') householdId: string,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
  ) {
    const clamped = Math.min(Math.max(take, 1), 200);
    return this.auditLog.listForHousehold(householdId, clamped);
  }
}
