import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

/**
 * Regra de ouro (SEGURANCA.md, seção 1 e 4):
 * "O backend nunca confia no frontend para autorização."
 *
 * Este guard roda em TODA rota escopada a um household (param `:householdId`),
 * independente do que a UI mostrou ou escondeu para o usuário:
 *
 *   1. Confirma que o usuário autenticado é membro daquele Household
 *      (consulta o banco — nunca confia em nada que o cliente enviou sobre
 *      as próprias permissões). Isso vale até para rotas de leitura.
 *   2. Se a rota tem @RequirePermission('flag'), confirma que esse membro
 *      tem a flag marcada como true.
 *
 * Se qualquer checagem falhar, a rota nunca executa a lógica de negócio —
 * nem "só para ler o estado" antes de decidir.
 *
 * A membership resolvida fica em `request.membership` para os services
 * usarem no log de auditoria sem buscar de novo.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    const householdId: string | undefined =
      request.params?.householdId ?? request.body?.householdId;

    // Rota não escopada a household e sem permissão exigida: nada a fazer aqui
    // (a autenticação já foi resolvida pelo AuthGuard).
    if (!householdId && !requiredPermission) return true;

    if (!userId || !householdId) {
      throw new ForbiddenException('Household não identificado na requisição.');
    }

    const membership = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('Você não faz parte dessa ficha financeira.');
    }

    if (requiredPermission) {
      const hasPermission = (membership as Record<string, unknown>)[
        requiredPermission
      ];
      if (hasPermission !== true) {
        throw new ForbiddenException(
          `Ação não permitida: falta a permissão "${requiredPermission}".`,
        );
      }
    }

    request.membership = membership;
    return true;
  }
}
