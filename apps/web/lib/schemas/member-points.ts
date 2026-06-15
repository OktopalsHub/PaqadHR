import { z } from 'zod';

export const memberPointsBalanceSchema = z.object({
  memberId: z.string(),
  currentBalance: z.number(),
  totalEarned: z.number(),
  totalGiven: z.number(),
  monthlyGiven: z.number(),
  monthlyReceived: z.number(),
  monthlyAllowance: z.number(),
  remainingAllowance: z.number(),
  lastResetDate: z.string().or(z.date()),
});

export type MemberPointsBalance = z.infer<typeof memberPointsBalanceSchema>;
