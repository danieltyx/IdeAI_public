import { Elysia, t } from "elysia";
import { db } from '../../utils/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export const searchMainPlugin = (app: Elysia) =>
  app.get("/search/:id", async ({ params, server }) => {
    try {
      const docRef = doc(db, 'startup_ideas', params.id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Startup idea not found');
      }

      const data = docSnap.data();
      const name = data.name;
      const description = data.description;

      await updateDoc(docRef, {
        is_all_finished: false
      });

      const response = {
        status: 'success',
        data: {
          id: params.id,
          name,
          description: data.description,
          message: 'Background searches started for Devpost, YC, and GitHub'
        }
      };

      const searchPromise = Promise.allSettled([
        // Devpost search
        fetch(`${server?.hostname}:${server?.port}/search/devpost?q=${encodeURIComponent(name)}&analyze=true&ideaId=${params.id}`, {
          method: 'GET',
        })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Devpost search failed: ' + await response.text());
          }
          const searchResults = await response.json();
          console.log('Devpost search results:', searchResults);
          
          if (Array.isArray(searchResults)) {
            return searchResults;
          } else if (searchResults.status === 'success' && Array.isArray(searchResults.data)) {
            return searchResults.data;
          } else if (searchResults.status === 'error') {
            throw new Error('Devpost search error: ' + searchResults.message);
          }
          return [];
        }),

        // YC search
        fetch(`${server?.hostname}:${server?.port}/search/yc-external`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: description,
            ideaId: params.id
          })
        })
        .then(async (response) => {
          const ycResults = await response.json();
          console.log('YC search results:', ycResults);
          if (ycResults.status !== 'success' || !Array.isArray(ycResults.productIds)) {
            throw new Error('YC search failed');
          }
          return ycResults.productIds;
        }),

        // GitHub search
        fetch(`${server?.hostname}:${server?.port}/search/github`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: description,
            ideaId: params.id
          })
        })
        .then(async (response) => {
          const githubResults = await response.json();
          console.log('GitHub search results:', githubResults);
          if (githubResults.status !== 'success' || !Array.isArray(githubResults.productIds)) {
            throw new Error('GitHub search failed');
          }
          return githubResults.productIds;
        })
      ])
      .then(async (results) => {
        const docSnap = await getDoc(docRef);
        const existingIds = docSnap.exists() ? (docSnap.data().similar_product_ids || []) : [];
        
        const devpostIds = results[0].status === 'fulfilled' ? results[0].value : [];
        const ycIds = results[1].status === 'fulfilled' ? results[1].value : [];
        const githubIds = results[2].status === 'fulfilled' ? results[2].value : [];
        
        const allProductIds = [...new Set([...existingIds, ...devpostIds, ...ycIds, ...githubIds])];
        console.log('Combined product IDs:', allProductIds);
        
        await updateDoc(docRef, {
          similar_product_ids: allProductIds,
          is_all_finished: true
        });
      });

      return response;
      
    } catch (error: unknown) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  });