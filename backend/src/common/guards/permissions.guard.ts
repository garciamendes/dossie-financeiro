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
 * Este guard roda em TODA rota marcada com @RequirePermission, independente
 * do que a UI mostrou ou escondeu para o usuário. Ele:
 *   1. Descobre qual permissão a rota exige.
 *   2. Descobre a qual Household o recurso pertence (via param householdId).
 *   3. Confirma que o usuário autenticado é membro daquele Household.
 *   4. Confirma que esse membro tem a flag de permissão marcada como true.
 *
 * Se qualquer uma dessas checagens falhar, a rota nunca executa a lógica
 * de negócio — nem "só para ler o estado" antes de decidir.
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

    // Rota sem @RequirePermission: só autenticação já resolvida pelo AuthGuard.
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    const householdId: string | undefined =
      request.params?.householdId ?? request.body?.householdId;

    if (!userId || !householdId) {
      throw new ForbiddenException('Household não identificado na requisição.');
    }

    const membership = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId } },
    });

    if (!membership) {
      // Usuário autenticado, mas não pertence a essa ficha.
      throw new ForbiddenException('Você não faz parte dessa ficha financeira.');
    }

    const hasPermission = (membership as Record<string, unknown>)[
      requiredPermission
    ];

    if (hasPermission !== true) {
      throw new ForbiddenException(
        `Ação não permitida: falta a permissão "${requiredPermission}".`,
      );
    }

    // Guarda a membership na request — services usam pra registrar o log
    // de auditoria sem precisar buscar de novo.
    request.membership = membership;
    return true;
  }
}
