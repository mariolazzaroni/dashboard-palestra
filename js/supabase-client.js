import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";
import { supabaseAuthStorage } from "./auth-storage.js";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let supabase = null;
let supabaseInitializationError = null;

if (isSupabaseConfigured) {
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: supabaseAuthStorage,
      },
    });
  } catch (error) {
    supabaseInitializationError = error;
  }
}

export { supabase, supabaseInitializationError };
