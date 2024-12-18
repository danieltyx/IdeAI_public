// src/utils/webScraper.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { openai } from './openai';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function webpageToText(url: string, retryCount = 0): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 10000, // 10 second timeout
    });

    const $ = cheerio.load(response.data);

    // Remove script and style elements
    $('script').remove();
    $('style').remove();

    // Get text content
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    
    return text;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`Retry attempt ${retryCount + 1} for URL: ${url}`);
      await delay(RETRY_DELAY * (retryCount + 1)); // Exponential backoff
      return webpageToText(url, retryCount + 1);
    }

    if (axios.isAxiosError(error)) {
      throw new Error(`Error fetching webpage (after ${MAX_RETRIES} retries): ${error.message}`);
    }
    throw new Error(`Error processing webpage (after ${MAX_RETRIES} retries): ${error}`);
  }
}

export async function webSummarize(url: string): Promise<string> {
  try {
    const content = await webpageToText(url);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `summarize the following webpage in 3-5 sentences: ${content}`
        }
      ],
      temperature: 0.7
    });

    return completion.choices[0].message.content || 'No summary generated';
  } catch (error) {
    console.error(`Failed to summarize webpage: ${url}`, error);
    return ''; // Return empty string instead of throwing to prevent cascade failures
  }
}
