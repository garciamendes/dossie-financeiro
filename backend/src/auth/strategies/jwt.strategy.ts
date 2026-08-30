import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // O payload vira `req.user` em todo controller protegido por AuthGuard('jwt').
  // Um token de escopo "mfa" (2º passo de login) não vale como sessão real.
  async validate(payload: { sub: string; scope?: string }) {
    if (payload.scope === 'mfa') {
      throw new UnauthorizedException('Conclua o login com o código MFA.');
    }
    return { id: payload.sub };
  }
}
