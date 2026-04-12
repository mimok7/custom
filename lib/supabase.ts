import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function initSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const g = globalThis as Record<string, unknown>;
  if (g.__supabase) {
    _supabase = g.__supabase as SupabaseClient;
    return _supabase;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  g.__supabase = client;
  _supabase = client;
  return client;
}

const supabase = initSupabase();
export default supabase;
export { supabase };
