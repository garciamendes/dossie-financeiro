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
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

/**
 * Contas não têm permissão própria na tabela do PRD; tratamos "gerir conta"
 * como parte de gerir a configuração financeira da ficha:
 *   - ler: qualquer membro (o PermissionsGuard já exige pertencer à ficha);
 *   - criar/editar/excluir: reaproveita canCreateCharge / canEditCharge / canDeleteCharge.
 */
@Controller('households/:householdId/accounts')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class AccountsController {
  constructor(private accounts: AccountsService) {}

  @Get()
  list(@Param('householdId') householdId: string) {
    return this.accounts.list(householdId);
  }

  @Post()
  @RequirePermission('canCreateCharge')
  create(@Body() dto: CreateAccountDto, @Req() req: any) {
    return this.accounts.create(actorFromRequest(req), dto);
  }

  @Patch(':accountId')
  @RequirePermission('canEditCharge')
  update(
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: any,
  ) {
    return this.accounts.update(actorFromRequest(req), accountId, dto);
  }

  @Delete(':accountId')
  @RequirePermission('canDeleteCharge')
  remove(@Param('accountId') accountId: string, @Req() req: any) {
    return this.accounts.remove(actorFromRequest(req), accountId);
  }
}
