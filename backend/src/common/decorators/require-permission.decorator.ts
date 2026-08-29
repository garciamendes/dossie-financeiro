import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Marca uma rota como exigindo uma permissão específica do HouseholdMember.
 * Isso NÃO substitui a checagem no service — é a primeira camada, o
 * PermissionsGuard é a segunda. Ver SEGURANCA.md: "o backend nunca confia
 * só em uma camada".
 *
 * Uso: @RequirePermission('canMarkPaid')
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
