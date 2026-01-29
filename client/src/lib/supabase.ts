import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
let supabaseClient: SupabaseClient | null = null;
let configLoaded = false;

async function loadConfigIfNeeded(): Promise<void> {
  if (configLoaded) return;
  if (supabaseUrl && supabaseAnonKey) {
    configLoaded = true;
    return;
  }
  
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      supabaseUrl = config.supabaseUrl || supabaseUrl;
      supabaseAnonKey = config.supabaseAnonKey || supabaseAnonKey;
    }
  } catch (error) {
    console.error('Failed to fetch config:', error);
  }
  configLoaded = true;
}

function getClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase credentials not available. Auth features may not work.');
    }
    supabaseClient = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
  }
  return supabaseClient;
}

export async function initSupabase(): Promise<void> {
  await loadConfigIfNeeded();
  if (supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getClient()[prop as keyof SupabaseClient];
  }
});
