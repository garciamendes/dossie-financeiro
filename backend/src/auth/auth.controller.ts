import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  ActivateMfaDto,
  LoginDto,
  LoginMfaDto,
  RefreshDto,
  RegisterDto,
  SetPinDto,
} from './dto/auth.dto';

/**
 * Rotas de identidade. As que recebem senha/código têm rate limit mais
 * apertado que o global (SEGURANCA.md, seção 1 e 4).
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.name, dto.password);
  }

  /** Passo final do registro: valida o 1º código TOTP e só então emite tokens. */
  @Post('mfa/activate')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  activateMfa(@Body() dto: ActivateMfaDto) {
    return this.authService.activateMfa(dto.userId, dto.code);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /** Segundo passo do login quando o MFA já está ativo. */
  @Post('login/mfa')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  loginMfa(@Body() dto: LoginMfaDto) {
    return this.authService.loginMfa(dto.mfaToken, dto.code);
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.rotateRefreshToken(dto.refreshToken);
  }

  @Post('revoke-all')
  @UseGuards(AuthGuard('jwt'))
  revokeAll(@Req() req: any) {
    return this.authService.revokeAllSessions(req.user.id);
  }

  // Define o PIN de 4 dígitos usado para confirmar ações via bot.
  // Fica atrás do AuthGuard: só quem já está logado no app pode definir o próprio PIN.
  @Post('pin')
  @UseGuards(AuthGuard('jwt'))
  setPin(@Body() dto: SetPinDto, @Req() req: any) {
    return this.authService.setPin(req.user.id, dto.pin);
  }
}
