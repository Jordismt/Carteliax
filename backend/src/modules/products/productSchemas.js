import { z } from "zod";

const priceSchema = z
  .number()
  .finite()
  .min(0)
  .max(999999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
    "El precio solo puede tener dos decimales.",
  );

export const createProductSchema = z
  .object({
    name: z.string().trim().min(2).max(120),

    description: z.string().trim().max(1000).nullable().optional(),

    price: priceSchema,

    is_available: z.boolean().optional(),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),

    description: z.string().trim().max(1000).nullable().optional(),

    price: priceSchema.optional(),

    is_available: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Debes modificar al menos un campo.");
