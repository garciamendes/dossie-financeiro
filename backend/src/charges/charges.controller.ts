import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { actorFromRequest } from '../common/actor';
import { ChargesService } from './charges.service';
import { CreateChargeDto, UpdateChargeDto } from './dto/charge.dto';

/**
 * Toda rota aqui passa por dois guards, nessa ordem:
 *  1. AuthGuard('jwt')   -> confirma quem é a pessoa (autenticação).
 *  2. PermissionsGuard   -> confirma que a pessoa é membro DESSE household e,
 *     quando a rota exige, que tem a permissão granular — consultando o banco
 *     de novo, nunca confiando no que o cliente diz sobre si mesmo.
 */
@Controller('households/:householdId/charges')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ChargesController {
  constructor(private chargesService: ChargesService) {}

  @Get()
  list(@Param('householdId') householdId: string) {
    return this.chargesService.list(householdId);
  }

  @Post()
  @RequirePermission('canCreateCharge')
  create(@Body() dto: CreateChargeDto, @Req() req: any) {
    return this.chargesService.create(actorFromRequest(req), dto);
  }

  @Patch(':chargeId')
  @RequirePermission('canEditCharge')
  update(
    @Param('chargeId') chargeId: string,
    @Body() dto: UpdateChargeDto,
    @Req() req: any,
  ) {
    return this.chargesService.update(actorFromRequest(req), chargeId, dto);
  }

  @Delete(':chargeId')
  @RequirePermission('canDeleteCharge')
  remove(@Param('chargeId') chargeId: string, @Req() req: any) {
    return this.chargesService.remove(actorFromRequest(req), chargeId);
  }

  @Post(':chargeId/mark-paid')
  @RequirePermission('canMarkPaid')
  markPaid(@Param('chargeId') chargeId: string, @Req() req: any) {
    return this.chargesService.markRecurringChargeAsPaid(
      chargeId,
      actorFromRequest(req),
    );
  }
}
