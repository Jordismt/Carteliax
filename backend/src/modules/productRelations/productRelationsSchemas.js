import { z } from "zod";

export const attachProductSchema = z
  .object({
    productId: z.string().uuid(),
  })
  .strict();

export const updateProductAllergensSchema = z
  .object({
    allergenIds: z
      .array(z.number().int().positive())
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, "No puede haber alérgenos duplicados."),
  })
  .strict();
