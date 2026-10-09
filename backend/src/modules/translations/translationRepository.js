import { databaseError } from "./translationErrors.js";

export class TranslationRepository {
  constructor(db) { this.db = db; }
  async rpc(name, args = {}) {
    const { data, error } = await this.db.rpc(name, args).abortSignal(AbortSignal.timeout(10000));
    if (error) throw databaseError(error);
    return data;
  }
  status(menuId, actor) { return this.rpc("cx_translation_status", { p_menu: menuId, p_actor: actor }); }
  enqueue(menuId, actor, language, replaceManual) { return this.rpc("cx_translation_enqueue", { p_menu: menuId, p_actor: actor, p_language: language, p_replace_manual: replaceManual }); }
  mutate(menuId, actor, language, action, payload = {}) { return this.rpc("cx_translation_mutate", { p_menu: menuId, p_actor: actor, p_language: language, p_action: action, p_payload: payload }); }
  claim() { return this.rpc("cx_translation_claim"); }
  progress(job, completed, error = null) { return this.rpc("cx_translation_progress", { p_job: job.id, p_token: job.claim_token, p_completed: completed, p_error: error }); }
  finish(job, items) { return this.rpc("cx_translation_finish", { p_job: job.id, p_token: job.claim_token, p_items: items }); }
  async job(menuId, actor) {
    const { data, error } = await this.db.from('menu_translation_jobs')
      .select('id,language_code,status,completed_items,total_items,error_code,expires_at,lease_expires_at')
      .eq('menu_id', menuId).eq('requested_by', actor)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .abortSignal(AbortSignal.timeout(10000));
    if (error) throw databaseError(error);
    return privateJob(data);
  }
}

export function privateJob(job) {
  if (job && ["queued", "processing"].includes(job.status) && (Date.now() >= new Date(job.expires_at).getTime() || (job.status === "processing" && job.lease_expires_at && Date.now() >= new Date(job.lease_expires_at).getTime()))) {
    return { ...job, status: "failed", error_code: "WORKER_INTERRUPTED" };
  }
  return job;
}

export function privateStatus(raw) {
  raw.job = privateJob(raw.job);
  const languages = raw.languages.map((language) => {
    const record = raw.menu_languages.find((item) => item.language_code === language.code);
    const items = raw.translations.find((item) => item.language === language.code)?.items ?? raw.items;
    const missing = items.filter((item) => !item.draft).length;
    const stale = items.filter((item) => item.draft && item.draft.source_hash !== item.source_hash).length;
    const manualStale = items.filter((item) => item.draft?.is_manual && item.draft.source_hash !== item.source_hash).length;
    const published = new Map((record?.published_items ?? []).map((item) => [`${item.type}:${item.id}`, item]));
    const unpublished = items.filter((item) => {
      const p = published.get(`${item.type}:${item.id}`), d = item.draft;
      return d && (!p || p.source_hash !== d.source_hash || p.name !== d.name || p.description !== d.description || (p.welcome_text ?? "") !== (d.welcome_text ?? ""));
    }).length;
    return { ...language, enabled: Boolean(record?.enabled), published_at: record?.published_at ?? null, missing, stale, manualStale, unpublished, total: items.length };
  });
  return { sourceLanguage: raw.source_language, publicReady: Boolean(raw.public_ready), languages, translations: raw.translations, items: raw.items, job: raw.job };
}
