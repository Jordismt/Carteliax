import { TranslationError } from "./translationErrors.js";
import { translationPrompt, TRANSLATION_LANGUAGES } from './translationQuality.js';

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function boundedJson(response) {
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 200000) { await reader.cancel(); throw new Error('response too large'); } chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}

function responseSchema(language) {
  return {
    type: "object", additionalProperties: false, required: ["language", "items"],
    properties: {
      language: { type: "string", enum: [language] },
      items: { type: "array", items: {
        type: "object", additionalProperties: false,
        required: ["type", "id", "name", "description", "welcome_text"],
        properties: { type: { type: "string", enum: ["menu", "category", "product", "restaurant"] }, id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, welcome_text: { type: "string" } },
      } },
    },
  };
}

export class GroqTranslationProvider {
  constructor({ apiKey, model = "openai/gpt-oss-120b", timeoutMs = 30000, fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
    this.apiKey = apiKey; this.model = model; this.timeoutMs = timeoutMs; this.fetch = fetchImpl; this.sleep = sleep;
  }

  async translate({ sourceLanguage, targetLanguage, items, context = [], terminology = [], retryIssues = [], retryCandidate = [] }) {
    if (!TRANSLATION_LANGUAGES[targetLanguage] || !TRANSLATION_LANGUAGES[sourceLanguage]) throw new TranslationError('CX_LANGUAGE', 'El idioma no está disponible.');
    if (!this.apiKey) throw new TranslationError("GROQ_NOT_CONFIGURED", "La traducción automática no está disponible. Puedes editar los textos manualmente.", 503);
    const model = this.model;
    const approximateTokens = Math.ceil(Buffer.byteLength(JSON.stringify(items.map(({ type, id, name, description, welcome_text }) => ({ type, id, name, description, welcome_text }))), "utf8") / 2);
    const payload = {
      model, temperature: 0, max_completion_tokens: Math.min(8192, Math.max(1536, approximateTokens * 2 + 1024)),
      ...(model.startsWith("openai/gpt-oss-") ? { reasoning_effort: 'medium' } : {}),
      response_format: { type: "json_schema", json_schema: { name: "restaurant_translation", strict: true, schema: responseSchema(targetLanguage) } },
      messages: [
        { role: "system", content: translationPrompt(sourceLanguage, targetLanguage) },
        { role: "user", content: JSON.stringify({ items: items.map(({ type, id, name, description, welcome_text }) => ({ type, id, name, description, welcome_text })), context, terminology, validation_feedback: retryIssues, previous_candidate: retryCandidate.map(({ type,id,name,description,welcome_text })=>({type,id,name,description,welcome_text})) }) },
      ],
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      try {
        response = await this.fetch(GROQ_URL, { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(this.timeoutMs) });
      } catch {
        // Timeout/network ambiguity: no automatic repeat of a possibly billed call.
        throw new TranslationError("GROQ_TIMEOUT", "La traducción ha tardado demasiado. No se ha cambiado ningún texto; inténtalo de nuevo.", 504);
      }
      if (response.status === 429 && attempt === 0) {
        const seconds = Number(response.headers.get("retry-after") ?? 2);
        if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 5) { await response.body?.cancel(); await this.sleep(Math.max(500, seconds * 1000)); continue; }
      }
      if (!response.ok) {
        if (response.status === 400) {
          const rejected = await boundedJson(response).catch(() => null);
          if (rejected?.error?.code === 'json_validate_failed') throw new TranslationError('INVALID_PROVIDER_OUTPUT', 'El proveedor no ha podido devolver una traducción válida. Tus textos siguen intactos.', 502);
        }
        await response.body?.cancel();
        const error = new TranslationError(response.status === 429 ? "GROQ_RATE_LIMIT" : "GROQ_UNAVAILABLE", response.status === 429 ? "El servicio de traducción está ocupado. Inténtalo más tarde." : "La traducción automática no está disponible ahora. Tus textos siguen intactos.", response.status === 429 ? 429 : 502);
        error.providerStatus = response.status;
        const requestId = response.headers.get("x-request-id");
        if (requestId && /^[a-zA-Z0-9_-]{1,120}$/.test(requestId)) error.providerRequestId = requestId;
        throw error;
      }
      // Bound response memory independently of the provider's token limit.
      try {
        const body = await boundedJson(response);
        if (body.choices?.[0]?.finish_reason !== "stop") throw new Error("incomplete response");
        return JSON.parse(body.choices[0].message.content);
      } catch (error) {
        if (error?.name === "AbortError" || error?.name === "TimeoutError") throw new TranslationError("GROQ_TIMEOUT", "La traducción ha tardado demasiado. Tus textos siguen intactos.", 504);
        throw new TranslationError("INVALID_PROVIDER_OUTPUT", "No se ha podido validar la traducción. No se ha cambiado ningún texto.", 502);
      }
    }
  }
}
