import { SetMetadata } from '@nestjs/common';
import type { FeatureAccess } from '../enums/subscription.enum';

export const FEATURES_KEY = 'required_features';

export const RequireFeatures = (...features: FeatureAccess[]) =>
  SetMetadata(FEATURES_KEY, features);
