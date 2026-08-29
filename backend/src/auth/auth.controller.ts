import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('name') name: string,
    @Body('password') password: string,
  ) {
    const user = await this.authService.register(email, name, password);
    return this.authService.issueTokens(user.id);
  }

  @Post('login')
  async login(@Body('email') email: string, @Body('password') password: string) {
    const user = await this.authService.validateCredentials(email, password);
    return this.authService.issueTokens(user.id);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.rotateRefreshToken(refreshToken);
  }

  // Define o PIN de 4 dígitos usado para confirmar ações via bot.
  // Fica atrás do AuthGuard: só quem já está logado no app pode definir o próprio PIN.
  @Post('pin')
  @UseGuards(AuthGuard('jwt'))
  setPin(@Body('pin') pin: string, @Req() req: any) {
    return this.authService.setPin(req.user.id, pin);
  }
}
