import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { actorFromRequest } from '../common/actor';
import { RemindersService } from './reminders.service';
import { ReplyReminderDto } from './dto/reminder.dto';

@Controller('households/:householdId/reminders')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RemindersController {
  constructor(private reminders: RemindersService) {}

  @Get()
  list(
    @Param('householdId') householdId: string,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
  ) {
    const clamped = Math.min(Math.max(take, 1), 200);
    return this.reminders.listForHousehold(householdId, clamped);
  }

  /** Responder um lembrete "pagou?" pelo painel (sim / não / valor). */
  @Post(':reminderId/reply')
  @RequirePermission('canMarkPaid')
  reply(
    @Param('reminderId') reminderId: string,
    @Body() dto: ReplyReminderDto,
    @Req() req: any,
  ) {
    return this.reminders.handleReply(reminderId, dto.reply, actorFromRequest(req));
  }

  /**
   * Dispara o scan sob demanda — útil pra testar o fluxo sem esperar o cron.
   * Exige canMarkPaid (é uma ação operacional sobre lembretes).
   */
  @Post('scan-now')
  @RequirePermission('canMarkPaid')
  scanNow() {
    return this.reminders.scanAndSend(new Date());
  }
}
