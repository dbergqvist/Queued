import { env } from '$env/dynamic/public';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '$lib/database.types';

const supabaseUrl = env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
