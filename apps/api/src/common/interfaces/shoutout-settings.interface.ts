import type { ShoutoutCelebrationTemplate } from './shoutout-celebration-template.interface';

export interface ShoutoutSettings {
  maxRecipientsPerShoutout: number;
  enableCategories: boolean;
  birthday?: ShoutoutCelebrationTemplate;
  workAnniversary?: ShoutoutCelebrationTemplate;
}
