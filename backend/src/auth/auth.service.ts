import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../crypto/encryption.service';

/**
 * Ver SEGURANCA.md, seção 1:
 *  - Hash de senha e PIN com Argon2id (não bcrypt).
 *  - Access token curto (15min) + refresh token rotativo — cada refresh
 *    usado uma vez, reuso de um token já trocado é sinal de roubo.
 *  - MFA (TOTP) obrigatório desde o primeiro login; o segredo TOTP é
 *    guardado cifrado (AES-256-GCM), nunca em claro.
 *  - Bloqueio progressivo de login por tentativas erradas.
 *  - PIN do bot é um segredo separado da senha da conta (nunca reaproveitado).
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private encryption: EncryptionService,
  ) {
    authenticator.options = { window: 1 };
  }

  // ---------- Registro + ativação de MFA ----------

  /**
   * Cria o usuário e já provisiona o segredo TOTP, mas NÃO emite tokens:
   * o login só se completa depois de `activateMfa` com um código válido.
   * Isso concretiza "MFA obrigatório desde o primeiro login".
   */
  async register(email: string, name: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ForbiddenException('E-mail já cadastrado.');

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const secret = authenticator.generateSecret();

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        totpSecretEnc: this.encryption.encrypt(secret),
        mfaEnabled: false,
        preferences: { create: {} },
      },
    });

    return { userId: user.id, mfa: await this.buildMfaProvisioning(email, secret) };
  }

  private async buildMfaProvisioning(email: string, secret: string) {
    const issuer = this.config.get<string>('MFA_ISSUER', 'Dossie Financeiro');
    const otpauthUrl = authenticator.keyuri(email, issuer, secret);
    return {
      secret,
      otpauthUrl,
      qrDataUrl: await QRCode.toDataURL(otpauthUrl),
    };
  }

  async activateMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecretEnc) throw new UnauthorizedException('Usuário inválido.');

    const secret = this.encryption.decrypt(user.totpSecretEnc);
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Código TOTP incorreto.');
    }

    if (!user.mfaEnabled) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });
    }
    return this.issueTokens(userId);
  }

  // ---------- Login (2 passos quando MFA está ativo) ----------

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) throw new UnauthorizedException();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        'Conta temporariamente bloqueada por tentativas de login. Tente mais tarde.',
      );
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      await this.registerFailedLogin(user.id, user.failedLoginCount);
      throw new UnauthorizedException();
    }

    // Sucesso: zera o contador de tentativas.
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }

    if (!user.mfaEnabled) {
      // Conta antiga/incompleta: força concluir a configuração de MFA.
      const secret = user.totpSecretEnc
        ? this.encryption.decrypt(user.totpSecretEnc)
        : authenticator.generateSecret();
      if (!user.totpSecretEnc) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { totpSecretEnc: this.encryption.encrypt(secret) },
        });
      }
      return {
        mfaSetupRequired: true,
        userId: user.id,
        mfa: await this.buildMfaProvisioning(user.email, secret),
      };
    }

    // Passo 2 pendente: token curtíssimo, escopo "mfa", só serve pra /auth/login/mfa.
    const mfaToken = this.jwt.sign(
      { sub: user.id, scope: 'mfa' },
      { expiresIn: '5m' },
    );
    return { mfaRequired: true, mfaToken };
  }

  async loginMfa(mfaToken: string, code: string) {
    let payload: { sub: string; scope?: string };
    try {
      payload = this.jwt.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('Sessão de login expirada, recomece.');
    }
    if (payload.scope !== 'mfa') throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.totpSecretEnc || !user.mfaEnabled) throw new UnauthorizedException();

    const secret = this.encryption.decrypt(user.totpSecretEnc);
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Código TOTP incorreto.');
    }
    return this.issueTokens(user.id);
  }

  private async registerFailedLogin(userId: string, currentCount: number) {
    const max = this.config.get<number>('LOGIN_MAX_FAILED', 10);
    const lockMinutes = this.config.get<number>('LOGIN_LOCK_MINUTES', 15);
    const next = currentCount + 1;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: next,
        lockedUntil:
          next >= max ? new Date(Date.now() + lockMinutes * 60_000) : undefined,
      },
    });
  }

  // ---------- Tokens ----------

  async issueTokens(userId: string) {
    const accessToken = this.jwt.sign(
      { sub: userId },
      { expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') },
    );

    const rawRefresh = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefresh)
      .digest('hex');
    const days = this.config.get<number>('REFRESH_TTL_DAYS', 30);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  /**
   * Rotação: o refresh recebido é imediatamente invalidado (revokedAt),
   * e um novo par é emitido. Se alguém tentar reusar um refresh já
   * revogado, isso é tratado como possível roubo — todas as sessões
   * do usuário são derrubadas.
   */
  async rotateRefreshToken(rawRefresh: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefresh)
      .digest('hex');
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      if (existing?.revokedAt) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: existing.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Sessão inválida, faça login novamente.');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(existing.userId);
  }

  /** Botão "revogar tudo" (SEGURANCA.md, seção 8): derruba todas as sessões. */
  async revokeAllSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  // ---------- PIN do bot (WhatsApp/Telegram) — segredo separado da senha ----------

  async setPin(userId: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) {
      throw new UnauthorizedException('PIN precisa ter exatamente 4 dígitos.');
    }
    const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { pinHash } });
    return { ok: true };
  }

  /**
   * Confirma o PIN antes de QUALQUER ação via bot que grave dado
   * (decisão do stakeholder: PIN sempre, não só em ações "críticas").
   * Ver SEGURANCA.md, seção 5.
   */
  async verifyPin(userId: string, pin: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.pinHash) return false;
    return argon2.verify(user.pinHash, pin);
  }
}
