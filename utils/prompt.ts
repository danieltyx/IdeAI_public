export const STARTUP_ADVISOR_PROMPT = `You are a startup advisor. Given a startup idea description, 
you'll generate an important follow-up questions. You must respond with a JSON object containing 'name' and 'question' fields.`;

export const STARTUP_ADVISOR_FOLLOWUP_PROMPT = `You are a startup advisor helping to refine a business
 idea through questions and answers. You must respond with JSON containing updatedDescription and nextQuestion fields.`;

export const PRODUCT_RELEVANCE_PROMPT = `You are an AI that determines product relevance. For each
 product, determine if it's relevant to the search query.`;

export const SIMILARITY_ANALYSIS_PROMPT = `You are an AI that identifies key product similarities.
For each product, analyze its relevance to the search query and provide 3-5 bullet points(about 5-10words each point).
You must respond with a JSON object in this exact format:
{
  "similarities": {
    "companyName1": ["Both are using xxx API", "Targeting XXX market", "Both want to solve XXX problem"],
    "companyName2": ["bullet point 1", "bullet point 2"]
  }
}`;


export const STARTUP_QUESTION_THEMES = [
  'What specific problem does your startup solve, and for whom?',
  'What\'s your unique solution or approach to solving this problem?',
  'What industry/market are you operating in?'
]; 

export const GENERATE_RANDOM_IDEA = `generate a random startup idea in descriptive language in one or two sentences, starting with "A platform.., A app..., etc"`;

export const GITHUB_SEARCH_TERMS_PROMPT = `You are a GitHub search term generator. Your task is to analyze product/idea descriptions and generate 5 search terms that will help find closely matching repositories on GitHub.

When generating search terms, you MUST:
- Stay strictly focused on the described product functionality
- Use terms that directly describe the core features
- Ensure each term would help find similar projects
- Avoid generic technical terms not specific to the product
- Consider how developers would descirbe and name such projects
- Contain short (2 words) and long search terms for border results

Format your response as a JSON object with a single "search_terms" array containing exactly 5 strings.

Warning: Each search term MUST help find repositories matching the specific product description. Avoid generic technical terms or related but different projects.

Remember: Always output valid JSON with exactly 5 search terms that would help find repositories implementing the described functionality.`;

export const GITHUB_RELEVANCE_PROMPT = `You analyze if two products or ideas are relevant. Consider the full context of the products rather than surface similarities.

Return JSON format: {"relevant": true} or {"relevant": false}`;

export const GITHUB_README_SUMMARY_PROMPT = `summrization in a few sentences in English (no explanation needed):`;