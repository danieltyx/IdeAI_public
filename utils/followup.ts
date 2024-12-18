import OpenAI from 'openai';
import { openai } from './openai';
import { STARTUP_ADVISOR_FOLLOWUP_PROMPT, STARTUP_QUESTION_THEMES } from './prompt';

export async function generateFollowupQuestion(description: string, previousQuestion: string, answer: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: STARTUP_ADVISOR_FOLLOWUP_PROMPT
      },
      {
        role: "user",
        content: `Original idea: "${description}"
Previous question: "${previousQuestion}"
Answer received: "${answer}"

Based on this answer, provide:
1. An updated version of the original idea incorporating the new information (two sentences max, keep it concise)
2. A new critical follow-up question to the founder about the idea to better understand and refine the idea (Use you to refer to the founder)

Respond with a JSON object containing:
- updatedDescription: the updated description incorporating the answer
- nextQuestion: your follow-up question

Consider these general themes for questions:
${STARTUP_QUESTION_THEMES.map(theme => `- ${theme}`).join('\n')}`
      }
    ]
  });

  const response = JSON.parse(completion.choices[0].message.content || '{}');
  
  return {
    updatedDescription: response.updatedDescription || '',
    nextQuestion: response.nextQuestion || ''
  };
} 