import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { actorFromRequest } from '../common/actor';
import { InstallmentsService } from './installments.service';
import { CreateInstallmentDto } from './dto/installment.dto';

@Controller('households/:householdId/installments')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class InstallmentsController {
  constructor(private installments: InstallmentsService) {}

  @Get()
  list(@Param('householdId') householdId: string) {
    return this.installments.list(householdId);
  }

  @Post()
  @RequirePermission('canCreateCharge')
  create(@Body() dto: CreateInstallmentDto, @Req() req: any) {
    return this.installments.create(actorFromRequest(req), dto);
  }

  @Post(':purchaseId/register-payment')
  @RequirePermission('canMarkPaid')
  registerPayment(@Param('purchaseId') purchaseId: string, @Req() req: any) {
    return this.installments.registerPayment(purchaseId, actorFromRequest(req));
  }
}
