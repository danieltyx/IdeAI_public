import { Elysia, t } from "elysia";
import { Product, DevpostResponse, ApiResponse } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { webSummarize } from '../../utils/webscraper';
import { db } from '../../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

async function fetchProductDetails(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    const descriptionMatch = html.match(/<div class="app-details">([^]*?)<\/div>/);
    return descriptionMatch?.[1]?.trim() ?? '';
  } catch (error) {
    console.error(`Error fetching product details from ${url}:`, error);
    return '';
  }
}

async function updateStartupIdeaProducts(ideaId: string, newProductIds: string[]) {
  const startupIdeaRef = doc(db, 'startup_ideas', ideaId);
  const startupIdeaDoc = await getDoc(startupIdeaRef);
  const existingProductIds = startupIdeaDoc.exists() 
    ? (startupIdeaDoc.data().similar_product_ids || [])
    : [];

  const updatedProductIds = [...new Set([...existingProductIds, ...newProductIds])];

  await setDoc(startupIdeaRef, {
    similar_product_ids: updatedProductIds
  }, { merge: true });

  return updatedProductIds;
}

export const devpostPlugin = (app: Elysia) =>
  app.get("/search/devpost", async ({ query }) => {
    try {
      console.log('Received search request with query:', query);
      const searchQuery = query?.q || '';
      const ideaId = query?.ideaId;
      
      if (!ideaId) {
        throw new Error('ideaId is required');
      }
      
      let allProducts: Product[] = [];
      
      const pagePromises = Array.from({ length: 3 }, async (_, i) => {
        const page = i + 1;
        const url = `https://devpost.com/software/search?page=${page}&query=${encodeURIComponent(searchQuery)}`;
  
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(30000),
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.text();
          const parsedData: DevpostResponse = JSON.parse(data);
        
          const products: Product[] = await Promise.all(
            parsedData.software.map(async (item) => {
              const description = await fetchProductDetails(item.url);
              const product = {
                id: uuidv4(),
                companyName: item.name,
                tagline: item.tagline || 'No tagline available',
                website: item.url,
                description,
                isRelevant: true,
                similarityAnalysis: [],
                source: 'devpost'
              };

              return product;
            })
          );
          
          return { products, total_count: parsedData.total_count };
        } catch (error) {
          console.error(`Error fetching page ${page}:`, error);
          return { products: [], total_count: 0 };
        }
      });

      console.log('Waiting for all pages to be processed...');
      const results = await Promise.all(pagePromises);
      
      results.forEach((result, index) => {
        allProducts = [...allProducts, ...result.products];
      });

      console.log(`Total products collected: ${allProducts.length}`);

      if (query.analyze === 'true') {
        console.log('Analysis requested, proceeding with analysis...');
        
        try {
          // First do relevance analysis
          const fetchOptions = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(60000),
            keepalive: true
          };

          const analysisPayload = {
            searchQuery,
            products: allProducts.map(p => ({
              id: p.id,
              companyName: p.companyName,
              tagline: p.tagline || 'No tagline available',
              website: p.website,
              description: p.description,
              source: 'devpost'
            }))
          };

          console.log('Sending analysis request with payload:', JSON.stringify(analysisPayload, null, 2));

          const analysisResponse = await fetch(
            `${app.server?.hostname}:${app.server?.port}/search/analyze-all`, 
            {
              ...fetchOptions,
              body: JSON.stringify(analysisPayload)
            }
          ).catch(error => {
            console.error('Analysis fetch error:', error);
            throw new Error('Failed to connect to analysis service');
          });

          if (!analysisResponse.ok) {
            const errorText = await analysisResponse.text().catch(() => 'No error details available');
            console.error('Analysis failed with status:', analysisResponse.status, 'Error:', errorText);
            throw new Error(`Analysis failed: ${analysisResponse.statusText} - ${errorText}`);
          }

          const analysis = await analysisResponse.json();
          
          if (analysis.status === 'success' && analysis.relevanceMap) {
            console.log('Updating product relevance...');
            allProducts.forEach((product) => {
              product.isRelevant = analysis.relevanceMap[product.companyName] === true;
            });

            // Now enhance only relevant products with web-scraped descriptions
            console.log('Enhancing relevant products with web-scraped descriptions...');
            for (const product of allProducts) {
              if (product.isRelevant) {
                try {
                  const webScrapedDescription = await webSummarize(product.website);
                  product.description = `${product.description}\n\nDetailed Summary:\n${webScrapedDescription}`;
                } catch (error) {
                  console.error(`Failed to scrape website for ${product.companyName}:`, error);
                }
              }
            }
            
            // Then do similarity analysis with enhanced descriptions
            const similarityResponse = await fetch(
              `${app.server?.hostname}:${app.server?.port}/search/similarity`,
              {
                ...fetchOptions,
                body: JSON.stringify({
                  searchQuery,
                  products: allProducts
                })
              }
            ).catch(error => {
              console.error('Similarity fetch error:', error);
              throw new Error('Failed to fetch similarity analysis');
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

                // Upload to Firebase after similarity analysis is complete
                const firebaseResponse = await fetch(`${app.server?.hostname}:${app.server?.port}/upload/firebase`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    products: allProducts
                      .filter(p => p.isRelevant)
                      .map(p => ({
                        id: p.id,
                        companyName: p.companyName,
                        tagline: p.tagline,
                        website: p.website,
                        description: p.description,
                        isRelevant: true,
                        source: 'devpost',
                        similarityAnalysis: Array.isArray(p.similarityAnalysis) ? p.similarityAnalysis.join(', ') : (p.similarityAnalysis || '')
                      }))
                  })
                });

                const firebaseResult = await firebaseResponse.json();

                if (firebaseResponse.ok && firebaseResult.status === 'success') {
                  console.log('Successfully uploaded to Firebase:', firebaseResult);
                  
                  // Get IDs of relevant products
                  const relevantIds = allProducts
                    .filter(p => p.isRelevant)
                    .map(p => p.id);
                  
                  // Update startup idea with new product IDs
                  await updateStartupIdeaProducts(ideaId, relevantIds);
                  
                  return relevantIds;
                } else {
                  console.error('Firebase upload failed:', firebaseResult);
                  return [];
                }
              }
            }
          } 
        } catch (error) {
          console.error('Error during analysis:', error);
          return [];
        }
      }

      // Return empty array if no analysis was performed
      return [];

    } catch (error: unknown) {
      console.error('Devpost search error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Devpost error'
      } as ApiResponse;
    }
  }, {
    query: t.Object({
      q: t.String(),
      analyze: t.Optional(t.String()),
      ideaId: t.String()
    })
  }); 