import { Elysia, t } from "elysia";
import { db } from '../../utils/firebase';
import { setDoc, doc } from 'firebase/firestore';
import { Product } from '../../types';
import { v4 as uuidv4 } from 'uuid';

async function searchProductHunt(query: string, page: number = 1): Promise<Product[]> {
  try {
    const url = `https://www.producthunt.com/search?q=${encodeURIComponent(query)}&page=${page}`;
    const response = await fetch(url);
    const html = await response.text();

    // Extract product information from the HTML
    // This is a simplified example - you'll need to adjust based on actual HTML structure
    const products: Product[] = [];
    const productElements = html.match(/<div class="styles_item__[^"]*"[^>]*>(.*?)<\/div>/g) || [];

    for (const element of productElements) {
      const nameMatch = element.match(/<h3[^>]*>(.*?)<\/h3>/);
      const taglineMatch = element.match(/<div class="styles_tagline__[^"]*"[^>]*>(.*?)<\/div>/);
      const urlMatch = element.match(/href="([^"]*)"/);

      if (nameMatch && taglineMatch) {
        const id = uuidv4();
        const companyName = nameMatch[1].trim();
        const tagline = taglineMatch[1].trim();
        const website = urlMatch ? `https://www.producthunt.com${urlMatch[1]}` : '';

        products.push({
          id,
          companyName,
          tagline,
          website,
          description: '',
          isRelevant: false,
          source: 'producthunt'
        });
      }
    }

    return products;
  } catch (error) {
    console.error('ProductHunt search error:', error);
    return [];
  }
}

export const productHuntPlugin = (app: Elysia) =>
  app.get("/search/producthunt", async ({ query }) => {
    try {
      const searchQuery = query.q as string;
      const page = parseInt(query.page as string) || 1;

      if (!searchQuery) {
        throw new Error('Search query is required');
      }

      console.log(`Searching ProductHunt for: ${searchQuery} (page ${page})`);
      const allProducts = await searchProductHunt(searchQuery, page);

      if (allProducts.length === 0) {
        return {
          status: 'success',
          products: []
        };
      }

      // Analyze relevance using Cerebras
      const analysisResponse = await fetch(`${app.server?.hostname}:${app.server?.port}/search/analyze-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          searchQuery,
          products: allProducts
        })
      });

      if (!analysisResponse.ok) {
        throw new Error('Failed to analyze products');
      }

      const analysis = await analysisResponse.json();

      if (analysis.status === 'success' && Array.isArray(analysis.relevance)) {
        const relevanceMap = new Map<string, boolean>(
          analysis.relevance
            .slice(0, allProducts.length)
            .map((relevance: boolean, index: number) => [
              allProducts[index].companyName,
              relevance
            ])
        );

        allProducts.forEach((product) => {
          const relevance = relevanceMap.get(product.companyName);
          product.isRelevant = relevance === true;
        });

        // Get similarity analysis for relevant products
        const similarityResponse = await fetch(`${app.server?.hostname}:${app.server?.port}/search/similarity`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            searchQuery,
            products: allProducts
          })
        });

        if (similarityResponse.ok) {
          const similarityAnalysis = await similarityResponse.json();
          if (similarityAnalysis.status === 'success') {
            console.log('Updating product similarity analysis...');
            allProducts.forEach(product => {
              if (product.isRelevant) {
                product.similarityAnalysis = similarityAnalysis.similarities[product.companyName];
              }
            });
          }
        }

        // Upload relevant products to Firebase
        const relevantProducts = allProducts.filter(p => p.isRelevant);
        console.log(`Uploading ${relevantProducts.length} relevant products to Firebase...`);

        for (const product of relevantProducts) {
          await setDoc(doc(db, 'products', product.id), {
            companyName: product.companyName,
            tagline: product.tagline,
            website: product.website,
            description: product.description,
            similarityAnalysis: product.similarityAnalysis || '',
            source: 'producthunt',
            searchQuery
          });
        }
      }

      return {
        status: 'success',
        products: allProducts
      };

    } catch (error: unknown) {
      console.error('ProductHunt search error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'ProductHunt search failed'
      };
    }
  }, {
    query: t.Object({
      q: t.String(),
      page: t.Optional(t.String())
    })
  }); 