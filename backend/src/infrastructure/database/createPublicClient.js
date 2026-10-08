import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";

let publicClient = null;

export function createPublicClient() {
  if (publicClient) {
    return publicClient;
  }

  const url = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY.");
  }

  publicClient = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return publicClient;
}
