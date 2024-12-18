import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit, doc, setDoc } from "firebase/firestore";
import { Product, StartupIdea } from '../types';

if (!process.env.FIREBASE_API_KEY || 
    !process.env.FIREBASE_AUTH_DOMAIN || 
    !process.env.FIREBASE_PROJECT_ID || 
    !process.env.FIREBASE_STORAGE_BUCKET || 
    !process.env.FIREBASE_MESSAGING_SENDER_ID || 
    !process.env.FIREBASE_APP_ID) {
  throw new Error('Missing Firebase configuration');
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);


export async function uploadProducts(products: Product[], searchQuery?: string): Promise<any> {
  console.log('\n=== Starting Firebase Upload ===');
  console.log(`Total products to upload: ${products.length}`);
  console.log('Firebase config:', {
    projectId: process.env.FIREBASE_PROJECT_ID,
    hasAuth: !!process.env.FIREBASE_API_KEY
  });
  
  if (!products.length) {
    console.log('No products to upload');
    return;
  }

  const successfulUploads: string[] = [];
  const failedUploads: string[] = [];

  for (const product of products) {
    try {
      console.log(`\nUploading product: ${product.companyName}`);
      
      const docData = {
        id: product.id,
        company_name: product.companyName,
        tagline: product.tagline,
        website: product.website,
        description: product.description,
        similarity_analysis: product.similarityAnalysis || [],
        search_query: searchQuery,
        created_at: new Date().toISOString()
      };

      console.log('Document data:', JSON.stringify(docData, null, 2));

      const docRef = doc(db, 'products', product.id);
      await setDoc(docRef, docData);
      
      console.log(`✓ Successfully uploaded: ${product.companyName}`);
      successfulUploads.push(product.id);
    } catch (error) {
      console.error(`✗ Failed to upload ${product.companyName}:`, error);
      failedUploads.push(product.id);
    }
  }

  console.log('\n=== Upload Summary ===');
  console.log(`Successfully uploaded: ${successfulUploads.length} products`);
  console.log(`Failed uploads: ${failedUploads.length} products`);

  if (failedUploads.length > 0) {
    console.error('Failed product IDs:', failedUploads);
    throw new Error(`Failed to upload ${failedUploads.length} products`);
  }

  return {
    success: successfulUploads.length,
    failed: failedUploads.length,
    total: products.length
  };
}

