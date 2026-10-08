import "dotenv/config";

import { z } from "zod";

// ==========================================
// VALIDACIÓN DE VARIABLES DE ENTORNO
// ==========================================

const envSchema = z.object({
  // ========================================
  // SERVIDOR
  // ========================================

  MICROSITES_ENABLED: z.enum(["true", "false"]).default("false").transform(value => value === "true"),

  PORT: z.coerce.number().int().positive().default(5000),

  // Enable only after applying the additive translations migration.
  TRANSLATIONS_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  GROQ_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  GROQ_TRANSLATION_MODEL: z.string().min(1).max(100).default("openai/gpt-oss-20b"),

  FRONTEND_URL: z.url(),

  // ========================================
  // SUPABASE
  // ========================================

  SUPABASE_URL: z.url(),

  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),

  SUPABASE_SECRET_KEY: z.string().min(1),

  // ========================================
  // STRIPE
  // ========================================

  // Live billing requires an explicit matching mode, never an accidental key swap.
  STRIPE_MODE: z.enum(["test", "live"]).default("test"),
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_/),

  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  STRIPE_PRICE_ID: z.string().startsWith("price_"),

  // Missing VAT configuration blocks new Checkout, not existing public/billing flows.
  STRIPE_VAT_TAX_RATE_ID: z.preprocess(value => value === "" ? undefined : value, z.string().startsWith("txr_").optional()),
}).superRefine((config, ctx) => {
  if (!config.STRIPE_SECRET_KEY.startsWith(`sk_${config.STRIPE_MODE}_`)) ctx.addIssue({ code: "custom", path: ["STRIPE_SECRET_KEY"], message: "Stripe mode and secret key must match." });
  if (process.env.NODE_ENV === "production" && new URL(config.FRONTEND_URL).protocol !== "https:") ctx.addIssue({ code: "custom", path: ["FRONTEND_URL"], message: "Production frontend must use HTTPS." });
});

// ==========================================
// EXPORTAR CONFIGURACIÓN VALIDADA
// ==========================================

export const env = envSchema.parse(process.env);
