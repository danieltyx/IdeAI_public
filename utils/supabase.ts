import { createClient } from '@supabase/supabase-js';
import { Product } from '../types';
import { t } from 'elysia';
import { v4 as uuidv4 } from 'uuid';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true
  },
  db: {
    schema: 'public'
  },
});

export async function uploadProducts(products: Product[]): Promise<void> {
    try {
        const { data, error: insertError } = await supabase
            .from('product')
            .insert([{
                name: "Shape Your Future in Healthcare at Shrey Campus",
                
            }]
        );
    
        console.log('Insert response with options:', {
            data,
            error: insertError
        });
    } catch (e) {
        console.error('Insert error:', e);
    }
}

export type StartupIdea = {
  id: string;
  description: string;
  name: string;
  followup_question: string;
  created_at?: string;
} 


uploadProducts([]).then()