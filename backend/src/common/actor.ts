import { AuditChannel } from '../audit-log/audit-log.service';

/**
 * Quem está fazendo a ação, em qual ficha e por qual canal.
 * Todo service financeiro recebe isto e repassa ao AuditLogService —
 * nunca existe ação "anônima" dentro de um Household (SEGURANCA.md, seção 1).
 */
export interface ActorContext {
  userId: string;
  householdId: string;
  channel: AuditChannel;
}

/** Monta o ActorContext a partir da request já processada pelos guards. */
export function actorFromRequest(req: {
  user?: { id: string };
  params?: { householdId?: string };
}): ActorContext {
  return {
    userId: req.user!.id,
    householdId: req.params!.householdId!,
    channel: 'web',
  };
}
