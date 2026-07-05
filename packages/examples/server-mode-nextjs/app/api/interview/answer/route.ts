import { createInterviewAnswerHandler, ServerAnswerProcessor } from '@interview-sdk/server';
import { createMockAdapter } from '../../../../lib/mock-adapter';
import { questions, rubric } from '../../../../lib/questions';

// TODO: swap createMockAdapter() for a real provider before shipping, e.g.:
//   import { OpenAIAdapter } from '@interview-sdk/adapter-openai';
//   new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! })
const processor = new ServerAnswerProcessor({
  questions,
  rubric,
  adapter: createMockAdapter(),
  signingSecret: process.env.INTERVIEW_SIGNING_SECRET,
});

export const POST = createInterviewAnswerHandler(processor, {
  onError: (error) => console.error('interview answer processing failed', error),
});
