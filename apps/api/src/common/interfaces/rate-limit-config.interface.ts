import { RateLimitRule } from "./rate-limit-rule.interface";

export interface RateLimitConfig {
    rules: RateLimitRule[];
}
