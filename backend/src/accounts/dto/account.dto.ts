import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsEnum(AccountType)
  type!: AccountType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  institution?: string;

  /** Saldo inicial em centavos. Guardado cifrado (SEGURANCA.md, seção 2). */
  @IsOptional()
  @IsInt()
  @Min(0)
  balanceCents?: number;

  /** Número da conta / cartão. Guardado cifrado; só os últimos 4 ficam em claro. */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{4,20}$/, { message: 'Número deve ter de 4 a 20 dígitos.' })
  number?: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  institution?: string;

  @IsOptional()
  @IsInt()
  balanceCents?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{4,20}$/, { message: 'Número deve ter de 4 a 20 dígitos.' })
  number?: string;
}
