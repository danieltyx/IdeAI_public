import OpenAI from 'openai';
import { STARTUP_ADVISOR_PROMPT, STARTUP_QUESTION_THEMES } from './prompt';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateNameAndQuestion(description: string): Promise<{
  name: string;
  question: string;
}> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: STARTUP_ADVISOR_PROMPT
      },
      {
        role: "user",
        content: `Given this startup idea: ${description}
        1. Generate a few words that summarize the idea (2-4 words max)
        2. Generate 1 critical question to the founder about the idea to better understand and refine the idea (Use you to refer to the founder)
        
        Consider these general questions as guidance:
        ${STARTUP_QUESTION_THEMES.map(theme => `- ${theme}`).join('\n')}

        Respond with a JSON object containing:
        {
          "name": "your generated name",
          "question": "your generated question"
        }`
      }
    ]
  });

  const response = JSON.parse(completion.choices[0].message.content || '{}');
  return {
    name: response.name || '',
    question: response.question || ''
  };
} 