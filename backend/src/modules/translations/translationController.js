import { supabaseAdmin } from "../../infrastructure/database/supabase.js";
import { env } from "../../config/env.js";
import { TranslationRepository, privateStatus, privateJob } from "./translationRepository.js";
import { TranslationError } from "./translationErrors.js";
import { planTranslation, makeBatches } from "./translationService.js";
import { menuIdSchema, languageCodeSchema, generateSchema, sourceLanguageSchema, visibilitySchema, manualSchema, deleteSchema } from "./translationSchemas.js";
import { scheduleTranslation } from './translationRuntime.js';

const repository = new TranslationRepository(supabaseAdmin);
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new TranslationError("INVALID_REQUEST", "Los datos enviados no son válidos.");
  return result.data;
}

export function validateTranslationId(req, res, next) {
  if (!menuIdSchema.safeParse(req.params.id).success) return res.status(400).json({ success: false, message: "Identificador de carta no válido." });
  next();
}

export function translationAction(action, { store = repository, schedule = scheduleTranslation, config = env } = {}) {
  return async (req, res) => {
    try {
      if (!config.TRANSLATIONS_ENABLED) throw new TranslationError("TRANSLATIONS_DISABLED", "Los idiomas todavía no están disponibles en este servidor.", 503);
      const menuId = req.params.id, actor = req.user.id;
      if (action === "progress") {
        res.setHeader('Cache-Control', 'private, no-store');
        return res.json({ success: true, job: await store.job(menuId, actor) });
      }
      if (action === "status") return res.json({ success: true, ...privateStatus(await store.status(menuId, actor)) });
      if (action === "process") {
        parse(generateSchema.pick({}), req.body ?? {});
        if (!config.GROQ_API_KEY) throw new TranslationError("GROQ_NOT_CONFIGURED", "La traducción automática no está disponible.", 503);
        const job = privateJob(await store.job(menuId, actor));
        if (job?.status === 'queued') schedule();
        return res.status(job?.status === 'queued' ? 202 : 200).json({ success: true });
      }
      let language = action === "source" ? parse(sourceLanguageSchema, req.body).sourceLanguage : parse(languageCodeSchema, req.params.language);
      if (action === "generate") {
        const body = parse(generateSchema, req.body ?? {});
        if (!config.GROQ_API_KEY) throw new TranslationError("GROQ_NOT_CONFIGURED", "La traducción automática no está disponible. Puedes editar los textos manualmente.", 503);
        const current = await store.status(menuId, actor);
        const source = current.translations.find((t) => t.language === language)?.items ?? current.items;
        makeBatches(planTranslation(source, body.regenerate));
        const job = await store.enqueue(menuId, actor, language, body.regenerate);
        if (!job.unchanged) schedule();
        return res.status(job.unchanged ? 200 : 202).json({ success: true, job: job.unchanged ? null : job, message: job.unchanged ? "Los textos automáticos están actualizados. Revisa los cambios manuales pendientes, si los hay." : "Traducción iniciada." });
      }
      let body = {};
      if (action === "manual") body = parse(manualSchema, req.body);
      else if (action === "delete") body = parse(deleteSchema, req.body);
      else if (action === "visibility") body = parse(visibilitySchema, req.body);
      else if (action === "publish") parse(generateSchema.pick({}), req.body ?? {});
      await store.mutate(menuId, actor, language, action, body);
      return res.json({ success: true, message: action === "publish" ? "Idioma publicado y visible en tu carta." : action === "manual" ? "Traducción guardada. Publica para mostrarla en tu carta." : "Idiomas actualizados." });
    } catch (error) {
      const known = error instanceof TranslationError;
      if (!known) console.error("[TRANSLATION_API_FAILED]", { action, code: "UNEXPECTED_ERROR" });
      if (error?.code === "TRANSLATION_STORAGE") console.error("[TRANSLATION_STORAGE_FAILED]", { action, databaseCode: error.databaseCode });
      return res.status(known ? error.status : 500).json({ success: false, code: known ? error.code : "TRANSLATION_FAILED", message: known ? error.message : "No se han podido gestionar los idiomas. Inténtalo de nuevo.", ...(error?.code === "CX_SUBSCRIPTION" ? { code: "SUBSCRIPTION_REQUIRED", businessId: req.billingBusinessId } : {}) });
    }
  };
}
