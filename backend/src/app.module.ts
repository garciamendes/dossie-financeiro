import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HouseholdModule } from './household/household.module';
import { ChargesModule } from './charges/charges.module';
import { AuditLogModule } from './audit-log/audit-log.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HouseholdModule,
    ChargesModule,
    AuditLogModule,
    // Rate limiting global — SEGURANCA.md, seção 4: toda rota, especialmente
    // as que envolvem dinheiro, precisa de limite de requisições.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
