import { Elysia, t } from "elysia";
import { db } from '../utils/firebase';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

export const getResultPlugin = (app: Elysia) =>
  app.get("/get_result/:id", async ({ params }) => {
    try {

      const ideaRef = doc(db, 'startup_ideas', params.id);
      const ideaSnap = await getDoc(ideaRef);

      if (!ideaSnap.exists()) {
        throw new Error('Startup idea not found');
      }

      const ideaData = ideaSnap.data();
      const similarProductIds = ideaData.similar_product_ids || [];


      const similarProducts = await Promise.all(
        similarProductIds.map(async (productId: string) => {
          const productRef = doc(db, 'products', productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            return {
              id: productId,
              ...productSnap.data()
            };
          }
          return null;
        })
      );

      return {
        status: 'success',
        data: {
          id: params.id,
          name: ideaData.name,
          description: ideaData.description,
          followup_question: ideaData.followup_question,
          similar_products: similarProducts.filter(Boolean)
        }
      };
    } catch (error: unknown) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get results'
      };
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  }); 