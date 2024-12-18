import { Elysia, t } from "elysia";
import { analyzeSimilarityAndUpload } from '../../utils/similarity_analyzer';
import { searchFromGithub } from '../../engine/github';

export const githubPlugin = (app: Elysia) =>
  app.post("/search/github", async ({ body, server }) => {
    try {
      const { description, ideaId } = body;

      if (!description || !ideaId) {
        throw new Error('Description and ideaId are required');
      }

      console.log('Searching GitHub for:', description);
      const githubResults = await searchFromGithub(description);
      console.log('GitHub search results:', githubResults);

      // Analyze similarity and upload to Firebase
      const productIds = await analyzeSimilarityAndUpload(
        githubResults,
        description,
        server,
        ideaId
      );

      return {
        status: 'success',
        productIds
      };

    } catch (error: unknown) {
      console.error('GitHub search error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'GitHub search failed'
      };
    }
  }, {
    body: t.Object({
      description: t.String(),
      ideaId: t.String()
    })
  }); 