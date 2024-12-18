import { Elysia, t } from "elysia";
import { Product } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { analyzeSimilarityAndUpload } from '../../utils/similarity_analyzer';

async function fetchYCResults(description: string): Promise<Product[]> {
  try {
    const response = await fetch('https://yc-search.zeabur.app/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ description })
    });

    if (!response.ok) {
      throw new Error(`YC search failed: ${response.statusText}`);
    }

    const results = await response.json();
    return results.map((item: any) => ({
      id: uuidv4(),
      companyName: item.companyName,
      tagline: item.tagline,
      website: item.website,
      description: item.description || '',
      isRelevant: true,
      source: 'yc'
    }));
  } catch (error) {
    console.error('YC search error:', error);
    throw error;
  }
}

export const ycExternalPlugin = (app: Elysia) =>
  app.post("/search/yc-external", async ({ body, server }) => {
    try {
      const { description, ideaId } = body;

      if (!description || !ideaId) {
        throw new Error('Description and ideaId are required');
      }

      console.log(`Searching YC for idea: ${description}`);
      const allProducts = await fetchYCResults(description);

      if (allProducts.length === 0) {
        return {
          status: 'success',
          productIds: []
        };
      }

      // Analyze similarity and upload to Firebase
      const productIds = await analyzeSimilarityAndUpload(
        allProducts,
        description,
        server,
        ideaId
      );

      return {
        status: 'success',
        productIds
      };

    } catch (error: unknown) {
      console.error('YC external search error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'YC external search failed'
      };
    }
  }, {
    body: t.Object({
      description: t.String(),
      ideaId: t.String()
    })
  }); 