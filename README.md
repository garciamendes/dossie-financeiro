# Dossiê Financeiro

Sistema financeiro pessoal com um agente proativo: cobra fatura, projeta o
futuro do seu dinheiro, monta plano de ação e permite lançar tudo por
WhatsApp/Telegram. Pensado pra uso pessoal (casal), com espaço pra virar
produto depois.

## Estrutura do repositório

- **`docs/`** — decisões de produto e arquitetura:
  - `PRD_sistema_financeiro.md` — visão, roadmap por fases, stack, modelo de dados.
  - `SEGURANCA.md` — arquitetura de segurança (identidade, criptografia, permissões,
    canais externos, LGPD, resposta a incidente). Leitura obrigatória antes de
    mexer em auth, permissões ou pagamentos.
- **`design/`** — mockup interativo (HTML) do produto: dashboard, faturas com
  parcela automática, metas, modo dark/light, ocultar valores e a aba de
  Atividades (log de auditoria visível).
- **`backend/`** — API (NestJS + Prisma). Ver `backend/README.md` para o que
  já está implementado e os próximos passos.
- **`frontend/`** — dashboard web (Next.js + Tailwind) que consome a API.
  Ver `frontend/README.md`.

## Status atual

**Fase 1 (MVP) — backend e frontend completos.**

Backend: autenticação Argon2id com MFA/TOTP obrigatório e refresh rotativo;
Household com convites e permissões granulares validadas no backend em toda
rota; CRUD de contas (com criptografia de campo AES-256-GCM), faturas,
compras parceladas (transição automática de parcela), metas e lançamentos;
dashboard com projeção de fluxo de caixa; motor de lembretes agendado
(BullMQ + Redis) com deduplicação e resposta "pagou?"; aba de Atividades
(log de auditoria). Testes cobrindo os fluxos críticos.

Frontend: fluxo completo de auth (registro + ativação de MFA, login em 2
passos), onboarding de ficha, aceite de convite, e o dashboard com as 4
abas do mockup (Painel, Faturas & Contas, Metas & Sonhos, Atividades),
tema claro/escuro e modo "ocultar valores".

Ainda faltam: webhooks do WhatsApp/Telegram (Fase 2), IA consultiva
(Fase 3) e integração com Pluggy (Fase 4) — ver
`docs/PRD_sistema_financeiro.md` para o roadmap completo.

## Subindo o stack localmente

```bash
docker compose -f backend/docker-compose.yml up -d   # Postgres + Redis
cd backend && npm install && cp .env.example .env    # ajuste os segredos
npm run prisma:migrate && npm run start:dev          # API em :3333
cd ../frontend && npm install && cp .env.local.example .env.local
npm run dev                                          # web em :3000
```
