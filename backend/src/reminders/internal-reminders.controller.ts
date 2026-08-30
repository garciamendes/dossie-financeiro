import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RemindersService } from './reminders.service';

/**
 * Gatilho do scan de lembretes por HTTP, para deploys sem worker/Redis
 * (ex: Render free). Um cron externo grátis (GitHub Actions agendado,
 * cron-job.org) bate aqui 1x/dia com o header `x-cron-secret`.
 *
 * Fora do prefixo /households — não é uma ação de usuário, é infraestrutura.
 * Protegido só pelo segredo compartilhado `CRON_SECRET`; se ele não estiver
 * configurado, a rota responde 403 sempre (fail-closed).
 */
@Controller('internal/reminders')
export class InternalRemindersController {
  constructor(
    private reminders: RemindersService,
    private config: ConfigService,
  ) {}

  @Post('scan')
  @HttpCode(200)
  async scan(@Headers('x-cron-secret') secret?: string) {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!expected || !secret || !safeEqual(secret, expected)) {
      throw new ForbiddenException('Segredo de cron inválido.');
    }
    return this.reminders.scanAndSend(new Date());
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
