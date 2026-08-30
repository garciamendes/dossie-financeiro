import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { HouseholdModule } from './household/household.module';
import { AccountsModule } from './accounts/accounts.module';
import { ChargesModule } from './charges/charges.module';
import { InstallmentsModule } from './installments/installments.module';
import { GoalsModule } from './goals/goals.module';
import { TransactionsModule } from './transactions/transactions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RemindersModule } from './reminders/reminders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogModule } from './audit-log/audit-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    // Redis + BullMQ — motor de lembretes agendados (PRD, seção 3).
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
      }),
    }),

    // Rate limiting global — SEGURANCA.md, seção 4: toda rota, especialmente
    // as que envolvem dinheiro, precisa de limite de requisições. Rotas de
    // auth têm limites mais apertados via @Throttle no controller.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    PrismaModule,
    CryptoModule,
    AuthModule,
    HouseholdModule,
    AccountsModule,
    ChargesModule,
    InstallmentsModule,
    GoalsModule,
    TransactionsModule,
    DashboardModule,
    RemindersModule,
    NotificationsModule,
    AuditLogModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
