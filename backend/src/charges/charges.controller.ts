import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ChargesService } from './charges.service';

/**
 * Toda rota aqui passa por dois guards, nessa ordem:
 *  1. AuthGuard('jwt')   -> confirma quem é a pessoa (autenticação).
 *  2. PermissionsGuard   -> confirma o que essa pessoa pode fazer NESSE
 *     household específico (autorização), consultando o banco de novo —
 *     nunca confiando em nada que o cliente enviou sobre suas próprias permissões.
 */
@Controller('households/:householdId/charges')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ChargesController {
  constructor(private chargesService: ChargesService) {}

  @Post(':chargeId/mark-paid')
  @RequirePermission('canMarkPaid')
  markPaid(
    @Param('householdId') householdId: string,
    @Param('chargeId') chargeId: string,
    @Req() req: any,
  ) {
    return this.chargesService.markRecurringChargeAsPaid(chargeId, {
      userId: req.user.id,
      householdId,
      channel: 'web',
    });
  }

  @Post('installments/:purchaseId/register-payment')
  @RequirePermission('canMarkPaid')
  registerInstallmentPayment(
    @Param('householdId') householdId: string,
    @Param('purchaseId') purchaseId: string,
    @Req() req: any,
  ) {
    return this.chargesService.registerInstallmentPayment(purchaseId, {
      userId: req.user.id,
      householdId,
      channel: 'web',
    });
  }
}
