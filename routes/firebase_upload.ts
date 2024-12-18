import { Elysia, t } from "elysia";
import { Product } from '../types';
import { db } from '../utils/firebase';
import { doc, setDoc } from 'firebase/firestore';

export const firebaseUploadPlugin = (app: Elysia) =>
  app.post("/upload/firebase", async ({ body }) => {
    try {
      const relevantProducts = (body.products as unknown as Product[]).filter((p: Product) => p.isRelevant);
      // console.log(`fuUploading ${relevantProducts.length} relevant products to Firebase...`);
      
      const uploadResults = await Promise.all(
        relevantProducts.map(async (product) => {
          try {
            const docRef = doc(db, 'products', product.id);
            await setDoc(docRef, {
              companyName: product.companyName,
              tagline: product.tagline,
              website: product.website,
              description: product.description,
              similarityAnalysis: product.similarityAnalysis || '',
              source: product.source || 'unknown',
              timestamp: new Date().toISOString()
            });
            
            console.log(`Uploaded ${product.companyName} to Firebase with ID: ${product.id}`);
            return { success: true, companyName: product.companyName, id: product.id };
          } catch (error) {
            console.error(`Failed to upload ${product.companyName}:`, error);
            return { success: false, companyName: product.companyName, error };
          }
        })
      );

      const successful = uploadResults.filter(r => r.success);
      const failed = uploadResults.filter(r => !r.success);

      console.log(`Upload complete: ${successful.length} succeeded, ${failed.length} failed`);

      return {
        status: 'success',
        uploaded: successful.length,
        failed: failed.length,
        results: uploadResults
      };
    } catch (error: unknown) {
      console.error('Firebase upload error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Firebase upload error'
      };
    }
  }, {
    body: t.Object({
      products: t.Array(t.Object({
        id: t.String(),
        companyName: t.String(),
        tagline: t.String(),
        website: t.String(),
        isRelevant: t.Boolean(),
        description: t.String(),
        similarityAnalysis: t.String(),
        source: t.String()
      }))
    })
  }); 