# Deploy — 100% grátis

Stack do deploy grátis:

| Peça | Serviço | Custo |
|---|---|---|
| Banco (Postgres) | **Neon** | grátis, não expira |
| Backend (NestJS) | **Render** — web service | grátis (hiberna após ~15 min sem tráfego) |
| Frontend (Next.js) | **Vercel** — Hobby | grátis |
| Cron dos lembretes | **GitHub Actions** agendado | grátis |
| Redis | — | não usa (`REMINDERS_QUEUE_ENABLED=false`) |

O backend hiberna no plano free do Render. Isso é contornado pelo workflow
`.github/workflows/reminders-cron.yml`, que 1×/dia acorda o serviço e dispara
`POST /internal/reminders/scan`. Enquanto você/parceiro usam o app, ele fica
acordado normalmente.

> Se um dia tiver ~US$5/mês: joga o backend + Postgres + Redis no **Railway**,
> liga `REMINDERS_QUEUE_ENABLED=true` e o cron passa a ser in-process (some a
> dependência do GitHub Actions). O resto continua igual.

---

## 0. Antes de tudo — gere os segredos

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # FIELD_ENCRYPTION_KEY  <- GUARDE NUM LUGAR SEGURO
openssl rand -hex 24   # CRON_SECRET
```

⚠️ **`FIELD_ENCRYPTION_KEY` não pode ser perdido nem trocado.** Saldo e número
de conta são cifrados com ele; se sumir, esses dados ficam ilegíveis pra
sempre. Anote fora do servidor (gerenciador de senhas).

---

## 1. Banco — Neon

1. cria conta em <https://neon.tech> → **New Project** (região mais perto —
   `aws-sa-east-1` / São Paulo).
2. em **Connection Details**, pega a string do endpoint **Pooled connection**
   e garante que ela tem `?sslmode=require`. O host tem `-pooler` no nome:
   `postgresql://USER:PASS@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require`
   - A instância free do Render é minúscula; adiciona
     `&connection_limit=5&pool_timeout=20` no fim pra não estourar o limite
     de conexões do Neon.
3. guarda pra usar como `DATABASE_URL` no Render.

As migrations rodam sozinhas no deploy do backend (`prisma migrate deploy` no
`startCommand`, a cada boot — é idempotente).

---

## 2. Backend — Render

1. conta em <https://render.com> (login com GitHub).
2. **New > Blueprint** → escolhe este repositório. O Render lê
   `backend/render.yaml` e cria o web service `dossie-backend`.
3. em **Environment**, preenche as variáveis marcadas como "preencher no
   painel":
   - `DATABASE_URL` → a string do Neon (passo 1)
   - `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `CRON_SECRET` → passo 0
   - `FRONTEND_URL` → a URL da Vercel (passo 3) — **volte aqui e ajuste**
     depois que o front estiver no ar. Sem barra no final.
4. deploy. Quando terminar, anota a URL: `https://dossie-backend.onrender.com`.
5. testa: `curl https://SEU-BACKEND.onrender.com/health` → `{"status":"ok",...}`

Sem `render.yaml` (deploy manual): New > Web Service, root `backend`,
build `npm ci --include=dev && npx prisma generate && npm run build`
(o `--include=dev` é obrigatório: com `NODE_ENV=production` o Render pularia
`@nestjs/cli` e o build quebraria),
start `npx prisma migrate deploy && node dist/main.js`, health check
`/health`, e as envs acima + `NODE_VERSION=20`, `NODE_ENV=production`,
`REMINDERS_QUEUE_ENABLED=false`, `REMINDER_TIMEZONE=America/Sao_Paulo`.

---

## 3. Frontend — Vercel

1. conta em <https://vercel.com> (login com GitHub) → **Add New > Project** →
   este repositório.
2. **Root Directory:** `frontend`. Framework detecta Next.js sozinho.
3. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = a URL do backend no Render (passo 2), sem barra.
     É lida em *build time* — se mudar depois, tem que **redeployar** o front.
4. deploy. Anota a URL: `https://dossie-financeiro.vercel.app`.
5. **volta no Render** e põe essa URL em `FRONTEND_URL` (senão o CORS bloqueia
   o front). Aguarda o redeploy do backend.

---

## 4. Cron dos lembretes — GitHub Actions

No repositório no GitHub, **Settings**:

- **Secrets and variables > Actions > Secrets** → `New repository secret`:
  - `CRON_SECRET` = o mesmo valor do passo 0 (igual ao do Render).
- **Secrets and variables > Actions > Variables** → `New repository variable`:
  - `BACKEND_URL` = `https://SEU-BACKEND.onrender.com` (sem barra).

O workflow `.github/workflows/reminders-cron.yml` já está no repo. Roda todo
dia às 11:00 UTC (08:00 BRT). Pra testar agora: aba **Actions** > "Scan de
lembretes (cron)" > **Run workflow**.

> Alternativa sem GitHub Actions: <https://cron-job.org> (grátis) — cria um job
> `POST https://SEU-BACKEND/internal/reminders/scan` com o header
> `x-cron-secret: <valor>`, 1×/dia.

---

## 5. Primeiro acesso

1. abre a URL da Vercel → **Criar conta** → configura o MFA (app
   autenticador) → cria a ficha.
2. em **Atividades > Gerar convite**, copia o link e manda pra outra pessoa.

---

## Notas / dívidas conhecidas

- **`npm audit`** ainda acusa advisories do `next` < 16. O `14.2.35` é a
  release de segurança mantida da linha 14.2 (o `audit` não modela os
  backports). Subir pra Next 15/16 é uma tarefa à parte.
- **Backup do banco:** Neon free tem retenção curta de histórico. Pra algo
  sério, exportar `pg_dump` periódico ou ir pro plano pago.
- **Rate limiting** é em memória (`@nestjs/throttler`) — ok com 1 instância,
  que é o caso no free.
- **Render hiberna:** a primeira request depois de um tempo ocioso demora
  ~30–50s (cold start). O cron diário reduz a chance de pegar frio.
- Migrar `refreshToken` pra cookie `httpOnly` se isto virar SaaS
  (`SEGURANCA.md`).
