import { Elysia, t } from "elysia";
import { db } from "../utils/firebase";
import { doc, getDoc } from "firebase/firestore";

export const statusPlugin = (app: Elysia) =>
  app.get("/status/:id", async ({ params }) => {
    try {
      const docRef = doc(db, 'startup_ideas', params.id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Startup idea not found');
      }

      const data = docSnap.data();
      return {
        status: 'success',
        data: {
          id: params.id,
          name: data.name,
          result_count: Array.isArray(data.similar_product_ids) ? data.similar_product_ids.length : 0,
          is_all_finished: data.is_all_finished || false
        }
      };
    } catch (error: unknown) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Status check failed'
      };
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  }); 