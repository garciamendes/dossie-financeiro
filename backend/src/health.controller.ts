import { Controller, Get } from '@nestjs/common';

/**
 * Endpoint de saúde para o health check da plataforma (Render, etc.) e para
 * o "keep-alive" externo que acorda o serviço em planos que hibernam.
 * Não toca no banco de propósito — precisa ser barato e sempre responder.
 */
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', ts: new Date().toISOString() };
  }
}
