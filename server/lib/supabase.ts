import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('SUPABASE_URL environment variable is not set!');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPA') || k.includes('DATABASE')));
}

if (!supabaseAnonKey) {
  console.error('SUPABASE_ANON_KEY environment variable is not set!');
}

if (!supabaseServiceKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not found. Auth admin operations will fail.');
}

let supabase: SupabaseClient;
let supabaseAdmin: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey || supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
} else {
  console.error('Cannot initialize Supabase clients - missing required environment variables');
  supabase = null as any;
  supabaseAdmin = null as any;
}

export { supabase, supabaseAdmin };

export const isSupabaseAdminConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseServiceKey);
};
