import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  // Senha longa é a defesa principal; o hash é Argon2id (SEGURANCA.md, seção 1).
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class SetPinDto {
  @Matches(/^\d{4}$/, { message: 'PIN precisa ter exatamente 4 dígitos.' })
  pin!: string;
}

/** Ativação do TOTP logo após o registro — MFA obrigatório desde o 1º login. */
export class ActivateMfaDto {
  @IsString()
  userId!: string;

  @Matches(/^\d{6}$/, { message: 'Código TOTP tem 6 dígitos.' })
  code!: string;
}

/** Segundo passo do login quando o usuário já tem MFA ativo. */
export class LoginMfaDto {
  @IsString()
  mfaToken!: string;

  @Matches(/^\d{6}$/, { message: 'Código TOTP tem 6 dígitos.' })
  code!: string;
}
