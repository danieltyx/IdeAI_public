import { Elysia, t } from "elysia";
import OpenAI from 'openai';
import { Product } from '../../types';
import { SIMILARITY_ANALYSIS_PROMPT } from '../../utils/prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const similarityPlugin = (app: Elysia) =>
  app.post("/search/similarity", async ({ body }) => {
    try {
      const relevantProducts = body.products.filter((p: Product) => p.isRelevant);
      console.log(`Generating similarity descriptions for ${relevantProducts.length} relevant products...`);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: SIMILARITY_ANALYSIS_PROMPT + "\nYou must respond with valid JSON in the following format: { \"similarities\": { \"companyName\": [\"similarity1\", \"similarity2\"] } }"
          },
          {
            role: "user",
            content: `Compare "${body.searchQuery}" with each of the following products:\n\n` +
              relevantProducts.map((product, index) => 
                `[${index + 1}] Product: ${product.companyName}\nTagline: ${product.tagline}\nDescription: ${product.description}\n`
              ).join('\n')
          }
        ],
        temperature: 0.7,
      });

      const analysis = completion.choices[0].message.content ?? '';
      let parsedAnalysis;
      
      try {
        parsedAnalysis = JSON.parse(analysis);
      } catch (parseError) {
        console.error('Failed to parse LLM response:', analysis);
        throw new Error('Invalid JSON response from LLM');
      }

      if (!parsedAnalysis.similarities || typeof parsedAnalysis.similarities !== 'object') {
        throw new Error('Invalid similarity response format - missing similarities object');
      }

      // Validate and normalize the response
      const normalizedSimilarities: Record<string, string[]> = {};
      let hasAnySimilarities = false;

      for (const product of relevantProducts) {
        const similarities = parsedAnalysis.similarities[product.companyName];
        const normalizedSims = Array.isArray(similarities) 
          ? similarities.filter(sim => sim && sim.trim()) // Remove empty strings
          : [String(similarities || 'No similarity analysis available')];
        
        if (normalizedSims.length > 0) {
          hasAnySimilarities = true;
        }
        normalizedSimilarities[product.companyName] = normalizedSims;
      }

      if (!hasAnySimilarities) {
        throw new Error('No valid similarities found in the analysis');
      }

      return {
        status: 'success',
        similarities: normalizedSimilarities
      };
    } catch (error: unknown) {
      console.error('Similarity analysis error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Similarity analysis error'
      };
    }
  }, {
    body: t.Object({
      searchQuery: t.String(),
      products: t.Array(t.Object({
        id: t.String(),
        companyName: t.String(),
        tagline: t.String(),
        website: t.String(),
        isRelevant: t.Boolean(),
        description: t.String(),
        source: t.String()
      }))
    })
  }); 