import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2, "El identificador debe tener al menos 2 caracteres.")
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "El identificador solo puede contener letras minúsculas, números y guiones.",
  );

export const createMenuSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    slug: slugSchema,
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const updateMenuSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    is_published: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Debes indicar al menos un campo.");
