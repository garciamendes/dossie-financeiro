# Dossiê Financeiro — Backend (esqueleto)

Ponto de partida do backend, seguindo `PRD_sistema_financeiro.md` e `SEGURANCA.md`.

## O que já está implementado

- **`prisma/schema.prisma`** — todas as entidades desenhadas: `User`, `Household`,
  `HouseholdMember` (com permissões granulares), `Invite`, `Account`,
  `RecurringCharge`, `InstallmentPurchase`, `Transaction`, `Goal`, `AuditLog`,
  `UserPreferences`, `RefreshToken`.
- **`AuthService`** — hash de senha e PIN com Argon2id, emissão de access
  token (15min) + refresh token rotativo (uso único, reuso derruba todas
  as sessões).
- **`PermissionsGuard` + `@RequirePermission(...)`** — a regra de ouro do
  `SEGURANCA.md`: toda rota que altera dado consulta o banco de novo pra
  confirmar a permissão do membro, nunca confia no que o cliente diz sobre
  si mesmo.
- **`PinGuard`** — exigido em toda ação que vier do bot (WhatsApp/Telegram),
  antes de qualquer lógica de negócio rodar.
- **`ChargesService`** — `markRecurringChargeAsPaid` e
  `registerInstallmentPayment`, essa última já com a transição automática de
  parcela (avança, recalcula vencimento, quita ao bater o total) e chamando
  o `AuditLogService` em toda mudança.
- **`AuditLogService`** — grava e lista os eventos que alimentam a aba
  "Atividades" do produto.

## O que falta pra rodar de ponta a ponta (próximos passos)

1. `npm install` (dependências já estão no `package.json`).
2. Configurar `DATABASE_URL` (Postgres) e rodar `npm run prisma:migrate`.
3. Módulos ainda não escritos: `HouseholdModule` (criação de ficha, convites),
   `GoalsModule`, integração com Pluggy (Fase 4) e os handlers de webhook do
   WhatsApp Business API / Telegram Bot API (Fase 2), que vão validar
   assinatura do webhook antes de tudo (ver `SEGURANCA.md`, seção 5).
4. `AuthController` (rotas de login/registro/refresh) — o `AuthService` já
   tem a lógica, falta expor via HTTP.
5. Testes automatizados dos fluxos críticos: pagar fatura, avançar parcela,
   guard de permissão negando corretamente quem não tem a flag.

## Rodando localmente

```bash
npm install
cp .env.example .env   # defina DATABASE_URL e JWT_SECRET
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

> **Nota:** este código foi montado e testado (`npm install`, verificação de
> tipos) dentro de um sandbox com rede restrita, onde `binaries.prisma.sh`
> não é acessível — por isso `prisma generate` não pôde ser executado ali.
> Em uma máquina normal (ou dentro do Claude Code) isso funciona sem
> problema, já que só depende de internet completa.
