import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';

/**
 * Decisão do stakeholder: TODA ação via WhatsApp/Telegram que grava algo
 * exige o PIN de 4 dígitos, sempre — não só ações "críticas".
 * Isso roda ANTES da lógica de negócio (ex: ChargesService), então mesmo
 * que o webhook do WhatsApp/Telegram seja comprometido, uma mensagem sem
 * PIN válido nunca chega a alterar dado nenhum.
 */
@Injectable()
export class PinGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { userId, pin } = request.body ?? {};

    if (!userId || !pin) {
      throw new ForbiddenException('PIN obrigatório para confirmar essa ação.');
    }

    const valid = await this.authService.verifyPin(userId, pin);
    if (!valid) {
      throw new ForbiddenException('PIN incorreto.');
    }

    return true;
  }
}
