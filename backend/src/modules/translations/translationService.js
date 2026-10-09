import { TranslationError } from "./translationErrors.js";
import { outputSchema } from "./translationSchemas.js";
import { suspiciousTranslation, TRANSLATION_QUALITY_VERSION } from './translationQuality.js';

export const TRANSLATION_LIMITS = Object.freeze({ maxItems: 600, maxCharacters: 250000, batchItems: 30, batchCharacters: 12000, batchApproxTokens: 2400, maxBatches: 60 });
const key = (item) => `${item.type}:${item.id}`;

// The source hash comes from PostgreSQL. Price, allergens and availability never
// enter the provider payload or the hash.
export function planTranslation(items, regenerate = false) {
  return items.filter(item => !item.draft?.is_manual && (regenerate || item.draft?.source_hash !== item.source_hash || item.draft?.quality_version !== TRANSLATION_QUALITY_VERSION));
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
    if (original.type === 'restaurant' && item.name !== original.name) return fail();
    // Quantities/numbers must survive translation. Prices are never submitted.
    for (const field of ["name", "description", "welcome_text"]) {
      const numbers = (text) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ".")).sort().join("|");
      if (numbers(original[field]) !== numbers(item[field])) return fail();
    }
  }
  return parsed.data.items;
}

export async function translateSnapshot({ items, language, sourceLanguage, provider, onProgress, contextItems = items, existingTerminology = [] }) {
  const batches = makeBatches(items);
  const result = [];
  const context = contextItems.filter(item => ['menu','category','restaurant'].includes(item.type)).slice(0, 24).map(({ type, name }) => ({ type, name: name.slice(0,240) }));
  const terminology = existingTerminology.slice(0,24);
  for (const batch of batches) {
    let accepted, retryIssues = [], retryCandidate = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const output = await provider.translate({ sourceLanguage, targetLanguage: language, items: batch, context, terminology, retryIssues, retryCandidate });
        accepted = validateOutput(output, batch, language);
        const byKey = new Map(batch.map(item => [key(item), item]));
        retryIssues = accepted.flatMap(item => suspiciousTranslation(byKey.get(key(item)), item, language).map(issue => ({ type: item.type, id: item.id, ...issue })));
        if (retryIssues.length) throw new TranslationError('SUSPICIOUS_TRANSLATION', 'La traducción no supera las comprobaciones de calidad. Los textos anteriores siguen intactos.', 502);
        // Valencian showed spelling/agreement mistakes that language-marker
        // heuristics cannot detect. Reserve the existing second attempt for an
        // editorial pass, using the same model and the same bounded budget.
        if (language === 'val' && attempt === 0) { retryCandidate = accepted; retryIssues = [{ code: 'FINAL_EDITORIAL_REVIEW' }]; continue; }
        break;
      } catch (error) {
        if (attempt || !['INVALID_PROVIDER_OUTPUT','SUSPICIOUS_TRANSLATION'].includes(error.code)) throw error;
        retryCandidate = accepted ?? [];
        if (!retryIssues.length) retryIssues = [{ code: 'INVALID_PROVIDER_OUTPUT' }];
      }
    }
    result.push(...accepted);
    for (const item of accepted) {
      if (terminology.length === 24) terminology.shift();
      const original = batch.find(source => key(source) === key(item));
      terminology.push({ source: original.name.slice(0,240), translation: item.name.slice(0,240) });
    }
    await onProgress?.(result.length);
  }
  // Nothing is persisted until every batch has passed validation.
  return result;
}
