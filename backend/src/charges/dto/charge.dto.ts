import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateChargeDto {
  @IsString()
  @MaxLength(120)
  description!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

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

export class UpdateChargeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  accountId?: string | null;

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
