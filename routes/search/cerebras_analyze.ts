import { Elysia, t } from "elysia";
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { CerebrasCompletion } from '../../types';
import { PRODUCT_RELEVANCE_PROMPT } from '../../utils/prompt';

const cerebras = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY
});

export const cerebrasPlugin = (app: Elysia) =>
  app.post("/search/analyze-all", async ({ body }) => {
    try {
      const productsToAnalyze = body.products;
      console.log(`Analyzing ${productsToAnalyze.length} products...`);
      
      const completion = await cerebras.chat.completions.create({
        model: "llama-3.3-70b",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: PRODUCT_RELEVANCE_PROMPT
          },
          {
            role: "user",
            content: `Analyze these products for relevance to the search query "${body.searchQuery}":\n\n` +
              productsToAnalyze.map((product, index) => 
                `[${index + 1}] Product: ${product.companyName}\nTagline: ${product.tagline}\nDescription: ${product.description}\n`
              ).join('\n') +
              '\nRespond with a JSON object where keys are company names and values are boolean indicating relevance'
          }
        ],
        temperature: 0.7,
        stream: false
      }) as CerebrasCompletion;

      const analysis = JSON.parse(completion.choices[0].message.content);
      // console.log('Analysis:', analysis);

      return {
        status: 'success',
        relevanceMap: analysis
      };
    } catch (error: unknown) {
      console.error('Analysis error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Analysis error'
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
        description: t.String()
      }))
    })
  });