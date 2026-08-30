import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyReminderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  reply!: string;
}
