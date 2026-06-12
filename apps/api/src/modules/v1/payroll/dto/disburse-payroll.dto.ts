import { IsBoolean } from 'class-validator';

export class DisbursePayrollDto {
  @IsBoolean()
  confirmed: boolean;
}
