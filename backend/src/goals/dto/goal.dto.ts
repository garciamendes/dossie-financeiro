import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  targetAmountCents!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentAmountCents?: number;

  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  targetAmountCents?: number;

  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

export class ContributeGoalDto {
  /** Aporte em centavos (positivo adiciona, negativo corrige um lançamento errado). */
  @IsInt()
  amountCents!: number;
}
