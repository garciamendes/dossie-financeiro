import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInstallmentDto {
  @IsString()
  @MaxLength(120)
  description!: string;

  @IsInt()
  @Min(1)
  installmentAmountCents!: number;

  @IsInt()
  @Min(1)
  @Max(120)
  totalInstallments!: number;

  /** Parcelas já pagas antes de cadastrar (ex: comprou no 3º mês). */
  @IsOptional()
  @IsInt()
  @Min(0)
  currentInstallment?: number;

  @IsDateString()
  nextDueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  remindDaysBefore?: number;

  @IsOptional()
  @IsBoolean()
  remindViaWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  remindViaTelegram?: boolean;
}
