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
import { GoalsService } from './goals.service';
import { ContributeGoalDto, CreateGoalDto, UpdateGoalDto } from './dto/goal.dto';

@Controller('households/:householdId/goals')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class GoalsController {
  constructor(private goals: GoalsService) {}

  @Get()
  list(@Param('householdId') householdId: string) {
    return this.goals.list(householdId);
  }

  @Post()
  @RequirePermission('canManageGoals')
  create(@Body() dto: CreateGoalDto, @Req() req: any) {
    return this.goals.create(actorFromRequest(req), dto);
  }

  @Patch(':goalId')
  @RequirePermission('canManageGoals')
  update(
    @Param('goalId') goalId: string,
    @Body() dto: UpdateGoalDto,
    @Req() req: any,
  ) {
    return this.goals.update(actorFromRequest(req), goalId, dto);
  }

  @Post(':goalId/contribute')
  @RequirePermission('canManageGoals')
  contribute(
    @Param('goalId') goalId: string,
    @Body() dto: ContributeGoalDto,
    @Req() req: any,
  ) {
    return this.goals.contribute(actorFromRequest(req), goalId, dto);
  }

  @Delete(':goalId')
  @RequirePermission('canManageGoals')
  remove(@Param('goalId') goalId: string, @Req() req: any) {
    return this.goals.remove(actorFromRequest(req), goalId);
  }
}
