import { Product } from '../types';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function analyzeSimilarityAndUpload(
  products: Product[],
  searchQuery: string,
  server: { hostname?: string; port?: number } | null,
  ideaId: string
): Promise<string[]> {
  console.log('Sending similarity analysis request...');
  const similarityPayload = {
    searchQuery,
    products: products.map(p => ({
      id: p.id,
      companyName: p.companyName,
      tagline: p.tagline,
      website: p.website,
      description: p.description,
      isRelevant: true,
      source: p.source
    }))
  };
  console.log('Similarity payload:', JSON.stringify(similarityPayload, null, 2));

  const similarityResponse = await fetch(`${server?.hostname || 'localhost'}:${server?.port || 5432}/search/similarity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(similarityPayload)
  });

  let similarityAnalysis: { status: string; similarities: Record<string, string[]> } | undefined;
  if (similarityResponse.ok) {
    similarityAnalysis = await similarityResponse.json();
    console.log('Similarity analysis response:', JSON.stringify(similarityAnalysis, null, 2));
    
    if (similarityAnalysis?.status === 'success') {
      console.log('Updating product similarity analysis...');
      products.forEach(product => {
        const similarity = similarityAnalysis?.similarities[product.companyName];
        console.log(`Similarity for ${product.companyName}:`, similarity);
        product.similarityAnalysis = similarity;
      });

      // Upload to Firebase
      console.log(`Uploading ${products.length} products to Firebase...`);
      const productIds: string[] = [];

      for (const product of products) {
        await setDoc(doc(db, 'products', product.id), {
          companyName: product.companyName,
          tagline: product.tagline,
          website: product.website,
          description: product.description,
          similarityAnalysis: Array.isArray(product.similarityAnalysis) 
            ? product.similarityAnalysis.join(', ') 
            : (product.similarityAnalysis || ''),
          source: product.source,
          searchQuery: searchQuery,
          created_at: new Date().toISOString()
        });
        productIds.push(product.id);
      }

      return productIds;
    }
  }

  // If similarity analysis fails, upload products without analysis
  console.warn('Similarity analysis failed, proceeding with upload without analysis');
  const productIds: string[] = [];
  
  for (const product of products) {
    await setDoc(doc(db, 'products', product.id), {
      companyName: product.companyName,
      tagline: product.tagline,
      website: product.website,
      description: product.description,
      similarityAnalysis: '',
      source: product.source,
      searchQuery: searchQuery,
      created_at: new Date().toISOString()
    });
    productIds.push(product.id);
  }

  return productIds;
} 