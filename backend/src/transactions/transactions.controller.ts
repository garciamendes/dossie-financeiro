import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { actorFromRequest } from '../common/actor';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  ListTransactionsQueryDto,
} from './dto/transaction.dto';

@Controller('households/:householdId/transactions')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class TransactionsController {
  constructor(private transactions: TransactionsService) {}

  @Get()
  list(
    @Param('householdId') householdId: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactions.list(householdId, query);
  }

  @Post()
  @RequirePermission('canCreateCharge')
  create(@Body() dto: CreateTransactionDto, @Req() req: any) {
    return this.transactions.create(actorFromRequest(req), dto);
  }

  @Delete(':transactionId')
  @RequirePermission('canDeleteCharge')
  remove(@Param('transactionId') transactionId: string, @Req() req: any) {
    return this.transactions.remove(actorFromRequest(req), transactionId);
  }
}
