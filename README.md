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

## Status atual

Fase 1 (MVP) em andamento: schema completo, autenticação com Argon2id,
permissões granulares validadas no backend, PIN obrigatório para ações via
bot, e a lógica de faturas/parcelas com log de auditoria automático.

Ainda faltam: módulo de Household/convites, rotas HTTP expostas, webhooks do
WhatsApp/Telegram (Fase 2) e integração com Pluggy (Fase 4) — ver
`docs/PRD_sistema_financeiro.md` para o roadmap completo.
