# Segurança & Confiabilidade — Dossiê Financeiro

Princípio geral: **o sistema deve ser projetado assumindo que vai ser atacado**, e cada camada abaixo assume que a anterior pode falhar (defesa em profundidade). Isso vira checklist obrigatório antes de cada fase entrar em produção, não uma lista de boas intenções.

## 1. Identidade e acesso

- **MFA obrigatório** desde o primeiro login (TOTP — Google Authenticator/Authy — não SMS, que é vulnerável a SIM swap).
- Senhas nunca em texto puro: hash com **Argon2id** (mais resistente que bcrypt para esse tipo de dado).
- **Rate limiting e bloqueio progressivo** em tentativas de login (ex: 5 tentativas → captcha, 10 → bloqueio temporário).
- Sessões com **tokens de curta duração (JWT ~15min) + refresh token rotativo**; todo refresh token usado uma vez é invalidado (detecta roubo de token).
- Se o produto virar SaaS: **RBAC** (dono da conta vs. colaborador/parceiro com permissão limitada, ex: "ver mas não editar").
- **Acesso de casal sem compartilhar senha**: a unidade financeira (`Household`) é separada da identidade (`User`). Cada pessoa se autentica com a própria conta e o próprio MFA; a associação entre pessoas acontece por **convite com token de validade curta**, nunca por credencial compartilhada. Remover um membro do `Household` não afeta o login da outra pessoa.
- Toda ação de qualquer membro é atribuída à pessoa que a fez — nunca existe uma ação "anônima" dentro do `Household` compartilhado.
- **O backend nunca confia no frontend para autorização.** Permissões granulares (quem pode criar, editar, excluir, marcar pagamento, gerenciar membros) são definidas pelo dono e **verificadas de novo em cada endpoint da API**, de forma independente do que a interface mostra ou esconde. Esconder um botão é UX; a garantia real é a validação no servidor — as duas existem, mas só a segunda é a que conta como segurança. Mudança de permissão de um membro é, ela mesma, uma ação auditada.

## 2. Dados financeiros — em repouso e em trânsito

- **TLS 1.3 em tudo**, sem exceção, incluindo comunicação interna entre serviços.
- **Criptografia de campo** (AES-256-GCM) para dados sensíveis específicos (saldo, número de conta, identificadores bancários) — não basta criptografar o disco do banco de dados inteiro, campos críticos são criptografados individualmente.
- **Gestão de chaves via KMS** (AWS KMS, GCP KMS, ou equivalente) — a aplicação nunca guarda a chave-mestra, só referencia o KMS.
- **Nunca armazenamos senha ou credencial bancária.** A conexão com o banco é via Pluggy (Open Finance), que já é a instituição regulada responsável por isso — nosso sistema só recebe o dado já autorizado, nunca a senha do seu banco.
- Números de cartão, quando exibidos, sempre **mascarados** (`•••• 4821`), nunca completos em log, tela ou banco de dados.

## 3. Segredos e infraestrutura

- Segredos (API keys, client secrets da Pluggy, tokens do WhatsApp/Telegram) ficam em um **cofre de segredos** (Railway secrets / AWS Secrets Manager / Doppler) — nunca em `.env` versionado, nunca hardcoded.
- Rotação periódica de credenciais e chaves de API.
- **Princípio do menor privilégio** em toda credencial de infraestrutura (o serviço de lembretes não tem permissão de escrever em dados de outro serviço, por exemplo).
- Ambientes isolados: dev / staging / produção nunca compartilham banco de dados, chaves ou segredos.
- **Backups automáticos criptografados**, com teste de restauração periódico (backup que nunca foi restaurado em teste não é backup confiável).

## 4. API e aplicação (contra os ataques mais comuns)

- Validação estrita de entrada em toda rota (schema validation — Zod/class-validator), rejeitando qualquer payload fora do esperado.
- ORM parametrizado (Prisma) elimina SQL injection por padrão — nunca query concatenada manualmente.
- **Rate limiting por usuário e por IP** em todas as rotas, especialmente nas que envolvem dinheiro (registrar pagamento, editar valor).
- Headers de segurança (Helmet): CSP, HSTS, X-Frame-Options, X-Content-Type-Options.
- CORS restrito só aos domínios do próprio produto.
- Proteção CSRF nos formulários web.
- **Trilha de auditoria imutável**: toda ação sensível (criar/editar/excluir conta, marcar pagamento, mudar valor, convidar/remover membro, mudar preferência) gera um log com quem, o quê, quando e por qual canal.
- **Log não fica só no banco de dados — é uma tela do produto** ("Atividades"), porque com duas pessoas usando a mesma ficha financeira, transparência é a própria funcionalidade de segurança: qualquer membro do `Household` pode ver o histórico de ações de todos, inclusive as próprias. Isso também funciona como detector natural de uso indevido — uma ação que você não reconhece aparece ali, não só em um log técnico que ninguém olha.

## 5. Canais externos (WhatsApp / Telegram) — a superfície mais arriscada

Esse é o ponto mais delicado do sistema, porque é uma porta de entrada externa direto pras suas finanças:

- **Validação de assinatura em todo webhook**: Meta usa `X-Hub-Signature-256` (HMAC), Telegram usa token secreto na URL — toda mensagem recebida é validada antes de processar. Payload sem assinatura válida é descartado e logado como tentativa suspeita.
- **Vínculo verificado**: seu número de WhatsApp/Telegram é associado à sua conta uma única vez, com código de confirmação — ninguém consegue "conversar com seu agente financeiro" só por descobrir seu número.
- **PIN obrigatório em toda ação via bot que modifica dados** (decisão do stakeholder): o bot pode *avisar* e *perguntar* livremente sem PIN, mas qualquer ação que grava algo — marcar fatura como paga, lançar um gasto por foto/áudio, criar uma recorrência — exige o PIN de 4 dígitos antes de confirmar. Fluxo típico:
  1. Você manda "paguei a fatura do Nubank".
  2. O bot responde pedindo o PIN.
  3. Você envia o PIN (mensagem separada, nunca reaproveitada de outra ação — cada confirmação exige envio novo).
  4. Só então a ação é executada e o bot confirma o resultado.
  - PIN com tentativas limitadas (ex: 3 erradas → a ação é cancelada e é preciso confirmar no app).
  - PIN nunca é enviado em texto puro nos logs — comparado por hash, igual senha.
- **Idempotência**: se a mesma mensagem chegar duas vezes (comum em webhooks), o sistema não lança a transação em duplicidade.

## 6. LGPD e privacidade

- Dados financeiros são dado pessoal sensível — minimização: só coletamos o que o produto realmente usa.
- Consentimento explícito e revogável para a conexão bancária (o Open Finance já exige isso por lei, mas replicamos no nosso app: você vê e revoga o que está conectado).
- Direito de **exportar** e **excluir** todos os seus dados a qualquer momento.
- Política de retenção clara: logs de auditoria guardados por tempo definido, não indefinidamente.

## 7. Processo de desenvolvimento seguro (SDLC)

- **Secret scanning no CI** (gitleaks) — bloqueia commit se detectar chave/segredo no código.
- **Dependência vulnerável** monitorada automaticamente (Dependabot/Renovate + `npm audit` no CI).
- **SAST** (análise estática — Semgrep/CodeQL) rodando a cada PR.
- Revisão de código obrigatória em qualquer mudança que toque autenticação, pagamentos ou dados financeiros — mesmo sendo você sozinho hoje, isso vira hábito de revisar com calma antes de subir.
- Testes automatizados cobrindo os fluxos críticos (marcar pagamento, avançar parcela, cálculo de projeção) — esses são os que mais custam se quebrarem silenciosamente.

## 8. Resposta a incidentes

- Botão de **"revogar tudo"**: invalida todas as sessões e tokens ativos, força novo login com MFA.
- Contato e canal definidos para caso de suspeita de vazamento.
- Logs suficientes para reconstruir "o que aconteceu" sem guardar dado sensível demais no próprio log (nunca logar senha, token completo, ou valor de cartão).

## 9. Como isso entra no roadmap

Segurança não é uma fase separada — está embutida desde a Fase 1:

| Fase | O que já entra de segurança |
|---|---|
| 1 — MVP | Auth com MFA, hashing Argon2id, TLS, criptografia de campo, secrets em cofre, rate limiting, auditoria básica, backups |
| 2 — Bot | Validação de assinatura de webhook, vínculo verificado de número, idempotência |
| 3 — IA | Nunca enviar dado financeiro bruto desnecessário para o modelo; log de auditoria de toda ação decidida pela IA |
| 4 — Open Banking | Consentimento explícito e revogável, nunca armazenar credencial bancária (delegado à Pluggy) |
