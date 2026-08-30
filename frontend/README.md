# Dossiê Financeiro — Frontend (Fase 1 / MVP)

Dashboard web do Dossiê Financeiro. **Next.js 14 (App Router) + Tailwind +
TypeScript**, consumindo a API do `../backend`.

Estética "dossiê / papel carbono" portada de `../design/mockup-dossie-financeiro.html`
(fontes Special Elite / IBM Plex Mono / Inter via `next/font`).

## O que está implementado

### Autenticação (todo o fluxo do backend)
- **`/register`** — cria a conta e já mostra o QR do **MFA/TOTP obrigatório**;
  só depois de validar o primeiro código é que a sessão começa.
- **`/login`** — login em 2 passos: e-mail/senha → código do autenticador.
  Cobre também o caso `mfaSetupRequired` (conta sem MFA ainda).
- **`/onboarding`** — cria a primeira ficha (`Household`).
- **`/convite/[token]`** — aceitar convite com a própria conta.
- Cliente de API (`src/lib/api.ts`) com **refresh token rotativo automático**
  no 401 (uma tentativa, com deduplicação de chamadas concorrentes) e logout
  quando o refresh falha.

### Dashboard (`/`) — as 4 abas do mockup
- **Painel** — saldo, projeção de fluxo de caixa (com a data em que fica
  negativo), maior gasto do mês e a lista "vencendo em breve" com ação de
  marcar pago / registrar parcela. Botão "rodar lembretes agora".
- **Faturas & Contas** — formulário de cadastro (recorrência ou compra
  parcelada, com escolha de canais de aviso) e a lista de todas as contas
  com barra de progresso das parcelas e saldo devedor.
- **Metas & Sonhos** — metas com progresso e aporte mensal sugerido, criação
  de meta e registro de aporte.
- **Atividades** — a timeline de auditoria (quem fez o quê, por qual canal) e
  o painel de membros com geração de convite.
- **Tema claro/escuro** e **ocultar valores** (privacidade), ambos
  persistidos por dispositivo no `localStorage`.

### Permissões
O frontend **esconde/desabilita** ações que o membro não pode fazer
(`canMarkPaid`, `canCreateCharge`, `canManageGoals`, `canInviteMembers`) —
mas isso é só UX: quem garante é o backend, que revalida em toda chamada
(ver `../docs/SEGURANCA.md`).

## Rodando localmente

Precisa do backend no ar (ver `../backend/README.md`).

```bash
npm install
cp .env.local.example .env.local   # ajuste NEXT_PUBLIC_API_URL se necessário
npm run dev                        # http://localhost:3000
```

O `NEXT_PUBLIC_API_URL` (default `http://localhost:3333`) precisa bater com o
`FRONTEND_URL` configurado no backend, senão o CORS bloqueia.

```bash
npm run build      # build de produção
npm run typecheck  # tsc --noEmit
```

## Próximos passos (fora da Fase 1)

- Gráfico da série diária da projeção (o dado já vem em `projection.daily`).
- Tela de preferências (tema/ocultar valores salvos no backend, definir PIN).
- Edição/exclusão de contas e metas (endpoints já existem no backend).
- Migrar o refresh token para cookie `httpOnly` se o produto virar SaaS.
