import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { HouseholdService } from './household.service';

@Controller('households')
export class HouseholdController {
  constructor(private householdService: HouseholdService) {}

  // Criar a primeira ficha não exige permissão prévia — é o próprio usuário virando owner.
  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body('name') name: string, @Req() req: any) {
    return this.householdService.createHouseholdForOwner(req.user.id, name);
  }

  @Post(':householdId/invites')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('canInviteMembers')
  createInvite(
    @Param('householdId') householdId: string,
    @Body('channel') channel: string,
    @Req() req: any,
  ) {
    return this.householdService.createInvite(
      { userId: req.user.id, householdId, channel: 'web' },
      channel,
    );
  }

  // Aceitar convite exige só estar autenticado — a pertença ao household
  // ainda não existe nesse momento, então PermissionsGuard não se aplica aqui.
  @Post('invites/:token/accept')
  @UseGuards(AuthGuard('jwt'))
  acceptInvite(@Param('token') token: string, @Req() req: any) {
    return this.householdService.acceptInvite(token, req.user.id);
  }

  @Delete(':householdId/invites/:inviteId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('canInviteMembers')
  revokeInvite(
    @Param('householdId') householdId: string,
    @Param('inviteId') inviteId: string,
    @Req() req: any,
  ) {
    return this.householdService.revokeInvite(
      { userId: req.user.id, householdId, channel: 'web' },
      inviteId,
    );
  }

  @Patch(':householdId/members/:memberId/permissions')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('canManageMembers')
  updatePermissions(
    @Param('householdId') householdId: string,
    @Param('memberId') memberId: string,
    @Body() changes: Record<string, boolean>,
    @Req() req: any,
  ) {
    return this.householdService.updateMemberPermissions(
      { userId: req.user.id, householdId, channel: 'web' },
      memberId,
      changes,
    );
  }

  @Delete(':householdId/members/:memberId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('canManageMembers')
  removeMember(
    @Param('householdId') householdId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    return this.householdService.removeMember(
      { userId: req.user.id, householdId, channel: 'web' },
      memberId,
    );
  }
}
