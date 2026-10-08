import { TranslationError } from "./translationErrors.js";
import { outputSchema } from "./translationSchemas.js";

export const TRANSLATION_LIMITS = Object.freeze({ maxItems: 600, maxCharacters: 250000, batchItems: 30, batchCharacters: 12000, batchApproxTokens: 2400, maxBatches: 60 });
const key = (item) => `${item.type}:${item.id}`;

// The source hash comes from PostgreSQL. Price, allergens and availability never
// enter the provider payload or the hash.
export function planTranslation(items, replaceManual = false) {
  return items.filter((item) => item.draft?.source_hash !== item.source_hash && (!item.draft?.is_manual || replaceManual));
}

export function makeBatches(items) {
  if (items.length > TRANSLATION_LIMITS.maxItems) throw new TranslationError("CONTENT_LIMIT", "La carta es demasiado grande para traducirla de una vez.", 413);
  const batches = [];
  let batch = [], size = 0, tokens = 0, total = 0;
  for (const item of items) {
    const serialized = JSON.stringify({ type: item.type, id: item.id, name: item.name, description: item.description, welcome_text: item.welcome_text });
    const length = serialized.length;
    const estimatedTokens = Math.ceil(Buffer.byteLength(serialized, "utf8") / 2);
    if (length > TRANSLATION_LIMITS.batchCharacters || estimatedTokens > TRANSLATION_LIMITS.batchApproxTokens) throw new TranslationError("CONTENT_LIMIT", "Un texto supera el tamaño permitido.", 413);
    if (batch.length && (batch.length >= TRANSLATION_LIMITS.batchItems || size + length > TRANSLATION_LIMITS.batchCharacters || tokens + estimatedTokens > TRANSLATION_LIMITS.batchApproxTokens)) {
      batches.push(batch); batch = []; size = 0; tokens = 0;
    }
    batch.push(item); size += length; tokens += estimatedTokens; total += length;
  }
  if (batch.length) batches.push(batch);
  if (total > TRANSLATION_LIMITS.maxCharacters || batches.length > TRANSLATION_LIMITS.maxBatches) throw new TranslationError("CONTENT_LIMIT", "La carta supera el tamaño permitido.", 413);
  return batches;
}

export function validateOutput(value, source, language) {
  const parsed = outputSchema.safeParse(value);
  const fail = () => { throw new TranslationError("INVALID_PROVIDER_OUTPUT", "No se ha podido validar la traducción. El contenido anterior sigue intacto.", 502); };
  if (!parsed.success || parsed.data.language !== language || parsed.data.items.length !== source.length) return fail();
  const expected = new Map(source.map((item) => [key(item), item]));
  const seen = new Set();
  for (const item of parsed.data.items) {
    const original = expected.get(key(item));
    if (!original || seen.has(key(item))) return fail();
    seen.add(key(item));
    if (original.description && !item.description.trim()) return fail();
    if (!original.description && item.description.trim()) return fail();
    if (original.welcome_text && !item.welcome_text.trim()) return fail();
    if (!original.welcome_text && item.welcome_text.trim()) return fail();
    // Quantities/numbers must survive translation. Prices are never submitted.
    for (const field of ["name", "description", "welcome_text"]) {
      const numbers = (text) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ".")).sort().join("|");
      if (numbers(original[field]) !== numbers(item[field])) return fail();
    }
  }
  return parsed.data.items;
}

export async function translateSnapshot({ items, language, sourceLanguage, provider, onProgress }) {
  const batches = makeBatches(items);
  const result = [];
  for (const batch of batches) {
    const output = await provider.translate({ sourceLanguage, targetLanguage: language, items: batch });
    result.push(...validateOutput(output, batch, language));
    await onProgress?.(result.length);
  }
  // Nothing is persisted until every batch has passed validation.
  return result;
}
