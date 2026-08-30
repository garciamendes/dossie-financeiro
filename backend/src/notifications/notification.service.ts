import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationChannel = 'whatsapp' | 'telegram' | 'console';

export interface DeliveryResult {
  channel: NotificationChannel;
  ok: boolean;
  detail?: string;
}

/**
 * Camada de entrega de mensagens proativas (lembretes, resumos).
 *
 * Fase 1 (agora): só o canal `console` está de fato ligado — o objetivo é o
 * motor de lembretes funcionar ponta a ponta sem depender de credencial
 * externa. Os canais `whatsapp` e `telegram` são Fase 2: aqui já ficam o
 * ponto de extensão e a resolução de destinatários via ChannelLink
 * verificado (SEGURANCA.md, seção 5: só número/conta vinculado e confirmado
 * recebe mensagem do agente).
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  async notifyHousehold(
    householdId: string,
    text: string,
    channels: NotificationChannel[],
  ): Promise<DeliveryResult[]> {
    const memberUserIds = (
      await this.prisma.householdMember.findMany({
        where: { householdId },
        select: { userId: true },
      })
    ).map((m) => m.userId);

    const results: DeliveryResult[] = [];

    for (const channel of channels) {
      if (channel === 'console') {
        this.logger.log(`[console→household ${householdId}] ${text}`);
        results.push({ channel, ok: true });
        continue;
      }

      const links = await this.prisma.channelLink.findMany({
        where: {
          userId: { in: memberUserIds },
          provider: channel,
          verifiedAt: { not: null },
        },
      });

      if (links.length === 0) {
        results.push({
          channel,
          ok: false,
          detail: 'nenhum número/conta verificado nesse canal (Fase 2)',
        });
        continue;
      }

      // Fase 2: aqui entra o cliente da Meta Cloud API / Telegram Bot API.
      for (const link of links) {
        this.logger.warn(
          `[${channel}→${link.externalId}] entrega ainda não implementada (Fase 2): ${text}`,
        );
      }
      results.push({ channel, ok: false, detail: 'canal previsto para a Fase 2' });
    }

    return results;
  }
}
