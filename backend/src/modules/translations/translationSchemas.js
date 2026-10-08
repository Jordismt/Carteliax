import { z } from "zod";

export const menuIdSchema = z.string().uuid();
export const languageCodeSchema = z.string().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/).max(12);
export const resourceTypeSchema = z.enum(["menu", "category", "product"]);
export const generateSchema = z.object({ replaceManual: z.boolean().default(false) }).strict();
export const sourceLanguageSchema = z.object({ sourceLanguage: languageCodeSchema }).strict();
export const visibilitySchema = z.object({ enabled: z.boolean() }).strict();
export const manualSchema = z.object({
  type: resourceTypeSchema,
  id: menuIdSchema,
  name: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2000),
  welcome_text: z.string().trim().max(1000).default(""),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().min(0),
}).strict().refine((item) => (item.type !== "category" || item.description === "") && (item.type === "menu" || item.welcome_text === ""), "Este recurso no admite esos textos.");
export const deleteSchema = z.object({ type: resourceTypeSchema, id: menuIdSchema, revision: z.number().int().positive() }).strict();

const translatedItemSchema = z.object({
  type: resourceTypeSchema, id: menuIdSchema,
  name: z.string().trim().min(1).max(240),
  description: z.string().max(2000),
  welcome_text: z.string().max(1000),
}).strict();
export const outputSchema = z.object({ language: languageCodeSchema, items: z.array(translatedItemSchema).max(30) }).strict();
