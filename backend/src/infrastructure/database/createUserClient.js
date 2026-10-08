import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";

export function createUserClient(accessToken) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => accessToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
