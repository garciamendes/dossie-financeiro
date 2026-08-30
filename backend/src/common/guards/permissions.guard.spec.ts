import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function ctxWith(request: any, requiredPermission?: string) {
  const reflector = {
    get: jest.fn().mockReturnValue(requiredPermission),
  } as unknown as Reflector;

  const context = {
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;

  return { reflector, context };
}

describe('PermissionsGuard', () => {
  it('deixa passar rota sem household e sem permissão exigida', async () => {
    const prisma = { householdMember: { findUnique: jest.fn() } };
    const { reflector, context } = ctxWith({ user: { id: 'u1' }, params: {} });
    const guard = new PermissionsGuard(reflector, prisma as any);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.householdMember.findUnique).not.toHaveBeenCalled();
  });

  it('barra quem não é membro do household (mesmo em rota de leitura)', async () => {
    const prisma = {
      householdMember: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const { reflector, context } = ctxWith({
      user: { id: 'u1' },
      params: { householdId: 'h1' },
    });
    const guard = new PermissionsGuard(reflector, prisma as any);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('barra membro sem a flag de permissão exigida', async () => {
    const prisma = {
      householdMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'm1',
          canMarkPaid: false,
        }),
      },
    };
    const { reflector, context } = ctxWith(
      { user: { id: 'u1' }, params: { householdId: 'h1' } },
      'canMarkPaid',
    );
    const guard = new PermissionsGuard(reflector, prisma as any);
    await expect(guard.canActivate(context)).rejects.toThrow(/canMarkPaid/);
  });

  it('libera e anexa a membership quando a flag está marcada', async () => {
    const membership = { id: 'm1', canMarkPaid: true };
    const prisma = {
      householdMember: { findUnique: jest.fn().mockResolvedValue(membership) },
    };
    const request: any = { user: { id: 'u1' }, params: { householdId: 'h1' } };
    const { reflector, context } = ctxWith(request, 'canMarkPaid');
    const guard = new PermissionsGuard(reflector, prisma as any);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.membership).toBe(membership);
  });
});
