# Dossiê Financeiro — Backend (Fase 1 / MVP)

API do MVP, seguindo `../docs/PRD_sistema_financeiro.md` e `../docs/SEGURANCA.md`.
Stack: **NestJS + Prisma (PostgreSQL) + BullMQ (Redis)**.

## O que está implementado (Fase 1 completa)

### Identidade e sessão (`auth/`)
- Registro com hash **Argon2id** de senha e PIN.
- **MFA (TOTP) obrigatório desde o primeiro login**: `register` provisiona o
  segredo (guardado **cifrado**) e devolve `otpauthUrl` + QR; só depois de
  `POST /auth/mfa/activate` com um código válido é que tokens são emitidos.
- Login em 2 passos quando o MFA está ativo (`/auth/login` → `mfaToken` →
  `/auth/login/mfa`).
- Access token curto + **refresh token rotativo** (uso único; reuso de um
  token revogado derruba todas as sessões).
- **Bloqueio progressivo** de login por tentativas erradas
  (`LOGIN_MAX_FAILED` / `LOGIN_LOCK_MINUTES`).
- `POST /auth/revoke-all` — botão "revogar tudo" da `SEGURANCA.md`.
- Rate limit global + limites mais apertados nas rotas de `auth`.

### Household e permissões (`household/`, `common/guards/`)
- Criação de ficha, convites com token de validade curta, aceite sem
  compartilhar credencial, revogação, gestão de permissões granulares e
  remoção de membro — tudo auditado.
- `PermissionsGuard`: **toda** rota escopada a `:householdId` confirma no
  banco que o usuário é membro (inclusive rotas de leitura) e, quando há
  `@RequirePermission('flag')`, que o membro tem a flag.
- `PinGuard`: pronto para os webhooks de bot (Fase 2) — exige PIN antes de
  qualquer escrita vinda de WhatsApp/Telegram.

### Financeiro (`accounts/`, `charges/`, `installments/`, `goals/`, `transactions/`)
- CRUD de contas (saldo e número **cifrados com AES-256-GCM** por campo;
  exibição sempre mascarada `•••• 4821`).
- CRUD de recorrências + `mark-paid` (gera `Transaction`, idempotente no ciclo).
- Compras parceladas: criação + `register-payment` com a **transição
  automática** do PRD (avança a parcela, recalcula o vencimento, quita ao
  bater o total) — tudo numa transação de banco e no log.
- Metas / modo "sonho": CRUD + aporte, com **aporte mensal sugerido**
  recalculado a cada mudança (sobe sozinho se você atrasar).
- Lançamentos manuais com filtro por período/categoria.

### Dashboard (`dashboard/`)
- `GET .../dashboard/summary` — saldo total, faturas em aberto, parcelas
  ativas, progresso das metas, gasto do mês por categoria.
- `GET .../dashboard/projection?days=60` — **projeção de fluxo de caixa** dia
  a dia e a primeira data em que o saldo fica negativo. Núcleo é uma função
  pura testada (`dashboard/projection.ts`).

### Motor de lembretes (`reminders/`, `notifications/`)
- Job **BullMQ** agendado por cron (`REMINDER_SCAN_CRON`).
- `planReminders` (função pura, testada): N dias antes do vencimento →
  `upcoming`; no dia → `due_day` ("Você pagou a fatura X?"). Não lembra o que
  já está pago/quitado.
- Deduplicação por `dedupeKey` única no banco — o scan é idempotente mesmo
  rodando várias vezes no dia.
- Entrega via `NotificationService` com canais plugáveis; na Fase 1 só
  `console` está ligado (WhatsApp/Telegram são Fase 2, com resolução por
  `ChannelLink` verificado já modelada).
- `POST .../reminders/:id/reply` — interpreta "sim" / "não" / valor e marca
  o pagamento pelo mesmo caminho auditado do painel.

### Auditoria (`audit-log/`)
- `GET .../activity` — a aba "Atividades": timeline de quem fez o quê, por
  qual canal. Toda mutação dos services acima grava aqui.

## Rodando localmente

Pré-requisitos: PostgreSQL e Redis (ex: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16` e `docker run -p 6379:6379 redis:7`).

```bash
npm install
cp .env.example .env        # defina DATABASE_URL, JWT_SECRET, FIELD_ENCRYPTION_KEY (openssl rand -hex 32), REDIS_URL
npm run prisma:generate
npm run prisma:migrate      # aplica prisma/migrations/
npm run start:dev
```

Testes (fluxos críticos — pagamento, transição de parcela, projeção,
planejamento de lembrete, guard de permissão, criptografia):

```bash
npm test
```

## Próximos passos (fora da Fase 1)

- **Fase 2** — webhooks WhatsApp Cloud API / Telegram Bot API: validação de
  assinatura, vínculo verificado de número (`ChannelLink`), `PinGuard` em
  toda escrita, OCR/áudio.
- **Fase 3** — IA consultiva (resumo proativo, plano de economia) via
  Anthropic API.
- **Fase 4** — Open Banking via Pluggy.
- Transversais: passkeys, recovery codes de MFA, `KMS` real para a chave de
  campo, entidade de receita/salário na projeção.
