import { z } from "zod";
import { publicProfileSchema, publicSlugSchema } from "./publicProfileSchemas.js";

export const createBusinessSchema = z
  .object({
    name: z.string().trim().min(2).max(100),

    slug: z
      .string()
      .trim()
      .min(3)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),

    description: z.string().trim().max(500).optional(),

    public_slug: publicSlugSchema.optional(),
    public_profile: publicProfileSchema.optional(),
    default_language: z.enum(["es", "ca", "en"]).default("es"),
  })
  .strict();

export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    public_profile: publicProfileSchema.optional(),
    default_language: z.enum(["es", "ca", "en"]).optional(),
    primary_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Debes indicar al menos un campo.");
