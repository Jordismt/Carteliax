import { z } from "zod";

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    is_visible: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Debes modificar al menos un campo.");

export const reorderCategoriesSchema = z
  .object({
    categoryIds: z.array(z.string().uuid()).min(1).max(200),
  })
  .strict()
  .refine(
    (data) => new Set(data.categoryIds).size === data.categoryIds.length,
    "No puede haber categorías duplicadas.",
  );
