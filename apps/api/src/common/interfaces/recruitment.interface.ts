import { QuestionType } from '../enums';
export interface CustomQuestion {
  id: string;
  questionText: string;
  description?: string;
  questionType: QuestionType;
  isRequired: boolean;
  options?: string[];
  maxRating?: number;
}
