import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token de autenticación requerido.",
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token de autenticación vacío.",
      });
    }

    // Supabase valida el token y devuelve
    // la identidad del usuario autenticado.
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        message: "Sesión inválida o caducada.",
      });
    }

    req.user = data.user;
    req.accessToken = token;

    next();
  } catch (error) {
    next(error);
  }
}
