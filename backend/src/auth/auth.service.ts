import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ver SEGURANCA.md, seção 1:
 *  - Hash de senha com Argon2id (não bcrypt).
 *  - Access token curto (15min) + refresh token rotativo — cada refresh
 *    usado uma vez, reuso de um token já trocado é sinal de roubo.
 *  - PIN do bot é um segredo separado da senha da conta (nunca reaproveitado).
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(email: string, name: string, password: string) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    return this.prisma.user.create({
      data: { email, name, passwordHash, preferences: { create: {} } },
    });
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) throw new UnauthorizedException();

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException();

    return user;
  }

  async issueTokens(userId: string) {
    const accessToken = this.jwt.sign({ sub: userId }, { expiresIn: '15m' });

    const rawRefresh = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 dias
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
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      if (existing?.revokedAt) {
        // Reuso de token já rotacionado: revoga tudo por segurança.
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

  // --- PIN do bot (WhatsApp/Telegram) — segredo separado da senha ---

  async setPin(userId: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) {
      throw new UnauthorizedException('PIN precisa ter exatamente 4 dígitos.');
    }
    const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
    return this.prisma.user.update({ where: { id: userId }, data: { pinHash } });
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
