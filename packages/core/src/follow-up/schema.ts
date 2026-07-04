import { z } from 'zod';

export const followUpResponseSchema = z.object({
  prompt: z.string().min(1),
  difficulty: z.enum(['easier', 'same', 'harder']).optional(),
  targetsMissedConcepts: z.array(z.string()).optional().default([]),
});

export type FollowUpResponse = z.infer<typeof followUpResponseSchema>;
