import * as Joi from 'joi';

/**
 * Validação estrita de configuração (SEGURANCA.md, seção 3: segredos nunca
 * hardcoded, sempre vindos do cofre/ambiente). A app não sobe se faltar
 * qualquer segredo obrigatório — melhor falhar no boot do que rodar
 * meio-configurada e vazar dado.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3333),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  DATABASE_URL: Joi.string().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  REFRESH_TTL_DAYS: Joi.number().default(30),

  // Chave-mestra da criptografia de campo (AES-256-GCM): 32 bytes em hex (64 chars).
  // Em produção isto é uma referência ao KMS; no MVP local, um segredo do cofre.
  FIELD_ENCRYPTION_KEY: Joi.string().length(64).hex().required(),

  // Fila só é usada quando REMINDERS_QUEUE_ENABLED=true (deploy com Redis).
  REMINDERS_QUEUE_ENABLED: Joi.boolean().default(false),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // Motor de lembretes
  REMINDER_SCAN_CRON: Joi.string().default('0 8 * * *'), // todo dia 08:00
  REMINDER_TIMEZONE: Joi.string().default('America/Sao_Paulo'),

  // Segredo compartilhado do gatilho POST /internal/reminders/scan (cron
  // externo). Sem ele, a rota responde 403 sempre.
  CRON_SECRET: Joi.string().min(16).optional(),

  // Bloqueio progressivo de login (SEGURANCA.md, seção 1)
  LOGIN_MAX_FAILED: Joi.number().default(10),
  LOGIN_LOCK_MINUTES: Joi.number().default(15),

  MFA_ISSUER: Joi.string().default('Dossie Financeiro'),
});
