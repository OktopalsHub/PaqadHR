import { IsBoolean } from 'class-validator';

export class UpdateRecruitmentPreferencesDto {
  @IsBoolean()
  askEmailOnMove: boolean;
}
