# Sistema Financeiro Pessoal com Agente Proativo — PRD & Arquitetura

## 1. Visão do produto

Não é um app de finanças que espera você abrir ele. É um **agente financeiro chato** que:
- sabe tudo sobre sua vida financeira (contas, faturas, recorrências, salário, limite);
- te cobra antes de você esquecer (lembrete de fatura, pergunta "pagou?");
- te diz como você está e como vai ficar (projeção de fluxo de caixa);
- monta plano de ação — tanto pra "economizar mais" quanto pra "juntar pra um sonho";
- deixa registrar qualquer coisa do jeito mais preguiçoso possível (foto, áudio, WhatsApp/Telegram).

Público inicial: você mesmo. Desenhado para, se validar, virar um SaaS multi-usuário sem reescrever tudo do zero.

## 2. Fases do produto

### Fase 1 — MVP (agora)
**Objetivo:** ter o core financeiro rodando e o sistema já sendo "chato" com você.

- Cadastro de contas, cartões, faturas e recorrências (manual).
- Dashboard com gráficos: por onde o dinheiro está indo, saldo projetado, faturas em aberto.
- Motor de lembretes agendados:
  - N dias antes do vencimento → notificação.
  - No dia do vencimento → pergunta "Você pagou a fatura X?" via WhatsApp **e** Telegram.
  - Resposta simples (sim/não/valor) atualiza o status no sistema.
- Sem parsing de foto/áudio ainda — resposta em texto simples (sim/não/valor) já é aceitável pro bot nessa fase.

### Fase 2 — Captura sem fricção
- Bot entende foto de nota/comprovante (OCR + IA extrai valor, data, categoria, estabelecimento).
- Bot entende áudio ("gastei 50 reais no mercado hoje") e lança sozinho.
- Confirmação rápida antes de gravar ("Entendi: R$50, Mercado, Alimentação. Confirma?").

### Fase 3 — IA consultiva (o diferencial de verdade)
- Resumo periódico proativo (ex: toda segunda, ou quando pedir): "como estou".
- Projeção: "no ritmo atual, dia 25 seu saldo fica negativo".
- Plano de ação para economizar (baseado em categorias de gasto reais).
- Modo "sonho": você diz a meta (ex: "quero R$15.000 pra viagem em 10 meses") e a IA monta um plano de aporte mensal e monitora o progresso, ajustando se você atrasar.

### Fase 4 — Open Banking
- Conexão via **Pluggy** (produto "Meu Pluggy", gratuito para uso pessoal) para puxar saldo, extrato, fatura de cartão e limite direto do banco, eliminando lançamento manual.
- Se virar SaaS: migrar para o plano comercial da Pluggy (eles já são Iniciador de Transação de Pagamento autorizado pelo Banco Central, cobrindo o Open Finance Brasil).

## 3. Stack proposta

| Camada | Escolha | Por quê |
|---|---|---|
| Backend | Node.js + TypeScript (NestJS) | Tipagem forte para dados financeiros, ecossistema maduro para integrar WhatsApp/Telegram/Pluggy/Claude API, fácil de escalar para multi-tenant depois. |
| Banco de dados | PostgreSQL + Prisma ORM | Relacional é o certo para dados financeiros (contas, transações, recorrências têm relações claras); Prisma dá migrations e type-safety. |
| Filas/Agendamento | Redis + BullMQ | Necessário para os lembretes agendados e para não travar a API esperando resposta de IA/OCR. |
| Frontend | Next.js + Tailwind | Dashboard rápido de construir, deploy simples, e o código gerado no Claude Design (React/Tailwind) encaixa direto aqui. |
| WhatsApp | Meta Cloud API (oficial) | Integração não-oficial (Baileys) quebra sem aviso; API oficial é estável para algo que você vai depender todo dia. Tem tier gratuito para uso pessoal. |
| Telegram | Telegram Bot API | Gratuita, simples, sem burocracia — ótimo canal para começar a testar o fluxo de bot antes mesmo do WhatsApp aprovar. |
| IA | Anthropic API (Claude) | Geração dos planos de ação, resumos e, na Fase 2, extração de dados de foto/áudio. |
| Open Banking | Pluggy (Meu Pluggy → depois plano comercial) | Cobertura de +130 instituições no Brasil, schema único independente do banco. |
| Hospedagem | Railway (backend+DB+Redis) + Vercel (frontend) | Barato para começar sozinho, sem gerenciar servidor, e ambos escalam se virar SaaS. |

## 4. Modelo de dados inicial (alto nível)

- **User** (você, e futuramente outros usuários)
- **Account** (conta bancária, carteira, cartão — tipo, instituição, saldo)
- **RecurringCharge** (fatura/mensalidade/assinatura — valor, dia de vencimento, categoria, conta associada)
- **Transaction** (lançamento — valor, data, categoria, origem: manual/whatsapp/telegram/banco)
- **Goal** (sonho/meta — nome, valor alvo, prazo, aporte mensal sugerido, progresso)
- **ReminderLog** (histórico de lembretes enviados e respostas)
- **InstallmentPurchase** (compra parcelada — descrição, valor da parcela, total de parcelas, parcela atual, próximo vencimento, status: ativa/quitada)
- **UserPreferences** (atributo do `User`, não uma tela separada):
  - `theme`: `dark` \| `light` \| `system`
  - `hideValuesByDefault`: booleano — controla se o painel abre com valores ocultos ou visíveis
  - `pinHash`: hash do PIN de 4 dígitos usado para confirmar qualquer ação via bot (WhatsApp/Telegram)
  - `linkedChannels`: quais números/contas de WhatsApp e Telegram estão vinculados a essa conta

### Regra de transição automática — compras parceladas

Isso é core do MVP (não depende de IA nem de bot), então já entra na Fase 1.

Quando o usuário confirma o pagamento de uma parcela (pelo painel, WhatsApp ou Telegram):
1. O sistema marca a parcela atual como paga e gera a `Transaction` correspondente.
2. Incrementa `currentInstallment` e recalcula `nextDueDate` (soma 1 ciclo de cobrança — normalmente 1 mês).
3. Reagenda automaticamente o próximo lembrete (N dias antes do novo vencimento) — nenhuma ação manual necessária.
4. Se `currentInstallment == totalInstallments`, marca a compra como **quitada**, para de gerar lembretes e ela some da lista "em aberto" (fica só no histórico).

Ou seja: o usuário só interage uma vez por mês ("paguei"), e todo o ciclo de vida da compra — próxima parcela, novo prazo, encerramento — é responsabilidade do sistema, nunca do usuário.

## 5. Acesso compartilhado (casal) e logs

Isso muda a base do modelo de dados, então entra desde a Fase 1 em vez de ser um "adicional" depois.

### Como funciona sem compartilhar senha

- A unidade financeira deixa de pertencer a um `User` e passa a pertencer a um **`Household`** (a "ficha" compartilhada). Contas, faturas, metas e compras parceladas pertencem ao `Household`, não a uma pessoa só.
- Cada pessoa continua com **login próprio** (e-mail/senha ou passkey, MFA próprio, PIN próprio pro bot).
- Pra adicionar o parceiro(a): você gera um **convite** (link ou código com validade curta, ex: 24h). A outra pessoa cria a própria conta (ou usa uma existente) e aceita o convite — em nenhum momento uma credencial é digitada ou compartilhada entre vocês.
- Convite pode ser revogado a qualquer momento, e cada membro pode ser removido do `Household` sem afetar o login do outro.
- **Limite de 5 pessoas por `Household`** — cobre o casal hoje e deixa espaço pra virar "família" sem já ser open-ended como um SaaS multi-tenant.

### Permissões granulares (definidas pelo dono)

O dono (`owner`) não escolhe entre 2 ou 3 perfis fixos — ele define, por membro, o que essa pessoa pode fazer. `HouseholdMember` carrega um conjunto de permissões, por exemplo:

| Permissão | O que libera |
|---|---|
| `can_create_charge` | Cadastrar fatura/recorrência/compra parcelada |
| `can_edit_charge` | Editar uma fatura/recorrência existente |
| `can_delete_charge` | Excluir |
| `can_mark_paid` | Marcar pagamento (avançar parcela, quitar fatura) |
| `can_manage_goals` | Criar/editar metas e sonhos |
| `can_invite_members` | Gerar convite pra novo membro |
| `can_manage_members` | Mudar permissão de outro membro, remover membro |

O `owner` tem todas por padrão; `can_manage_members` é exclusiva do `owner` (senão um membro poderia se auto-promover).

**Regra inegociável:** essas permissões são verificadas **no backend, em toda chamada de API que altera dado** — nunca só escondendo botão na tela. O frontend pode ocultar uma ação que o usuário não tem permissão pra fazer (boa UX), mas isso é só cosmético; se a chamada chegar na API mesmo assim, o backend rejeita de novo, de forma independente. E toda mudança de permissão é, ela mesma, uma ação registrada no log de auditoria — "Você alterou a permissão de Marina: `can_delete_charge` removida".

### Novas entidades

- **Household** (id, nome — ex: "Você e Marina")
- **HouseholdMember** (userId, householdId, papel: `owner` \| `member`, entrou em, **permissões granulares** — ver abaixo)
- **Invite** (token, canal de envio, expira em, status: pendente/aceito/expirado/revogado)
- **AuditLog** (id, householdId, quem fez — `userId`, o quê — ação padronizada, em qual entidade, de onde — painel/WhatsApp/Telegram, quando, e um resumo do "antes → depois" sem dado sensível cru)

### Logs como feature visível, não só arquivo técnico

Você pediu pra **ver** os logs, não só ter eles guardados — então isso vira uma tela própria no produto ("Atividades"), tipo linha do tempo: quem marcou o quê como pago, quem criou uma meta, quem entrou no Dossiê, por qual canal. Já desenhei essa tela no mockup.

## 6. Próximos passos

1. Validar esse escopo e stack com você (este documento).
2. Desenhar as telas principais do MVP (dashboard, cadastro de conta/fatura, tela de meta) — aqui entra o **Claude Design**, para gerar os mockups visuais em cima dos fluxos que definirmos.
3. Criar o schema do banco (Prisma) e o esqueleto do backend.
4. Subir o bot do Telegram primeiro (mais rápido de aprovar) para validar o fluxo de lembrete/resposta.
5. Integrar WhatsApp Business API em paralelo.
