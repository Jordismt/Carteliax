import { translateSnapshot } from "./translationService.js";

// Durable PostgreSQL queue, SKIP LOCKED claims and token fencing allow multiple
// processes. No automatic replay of an interrupted/billed operation.
export function createTranslationWorker({ repository, provider, logger = console, deadline = () => undefined }) {
  let running = false, stopped = false, timer, active;
  const drainWaiters = [];
  function tick() {
    if (running) return active;
    if (stopped) return Promise.resolve();
    running = true;
    active = run();
    return active;
  }
  async function run() {
    let job, completed = 0;
    try {
      job = await repository.claim();
      if (!job) return;
      const checkedProvider = { translate: async (input) => {
        if (stopped) throw Object.assign(new Error("worker stopped"), { code: "WORKER_INTERRUPTED" });
        // Leave time for a provider timeout, progress writes and atomic finish.
        const endsAt = deadline();
        if (endsAt && endsAt.getTime() - Date.now() < 75000) throw Object.assign(new Error("invocation ending"), { code: "WORKER_INTERRUPTED" });
        if (Date.now() >= new Date(job.expires_at).getTime()) throw Object.assign(new Error("expired"), { code: "CX_EXPIRED" });
        // Subscription/ownership are rechecked before each billed request.
        const current = await repository.status(job.menu_id, job.requested_by);
        const freshItems = current.translations.find((t) => t.language === job.language_code)?.items ?? current.items;
        const freshById = new Map(freshItems.map((i) => [`${i.type}:${i.id}`, i]));
        for (const original of job.source_items) {
          const fresh = freshById.get(`${original.type}:${original.id}`);
          if (!fresh || fresh.source_hash !== original.source_hash || String(fresh.draft?.revision ?? 0) !== String(original.draft?.revision ?? 0)) {
            throw Object.assign(new Error("source changed"), { code: "CX_CHANGED" });
          }
        }
        await repository.progress(job, completed);
        return provider.translate(input);
      } };
      const items = await translateSnapshot({ items: job.source_items, language: job.language_code, sourceLanguage: job.source_language, provider: checkedProvider,
        onProgress: async (count) => { completed = count; await repository.progress(job, count); },
      });
      await repository.finish(job, items);
      logger.info("[TRANSLATION_COMPLETED]", { jobId: job.id, menuId: job.menu_id, language: job.language_code, items: items.length });
    } catch (error) {
      const code = typeof error?.code === "string" ? error.code : "TRANSLATION_FAILED";
      // Never log provider response, prompts, token, actor identity or credentials.
      logger.error("[TRANSLATION_FAILED]", { jobId: job?.id, code, databaseCode: error?.databaseCode, providerStatus: error?.providerStatus, providerRequestId: error?.providerRequestId });
      if (job) {
        try { await repository.progress(job, completed, code); }
        catch { logger.error("[TRANSLATION_STATE_WRITE_FAILED]", { jobId: job.id }); }
      }
    } finally { running = false; for (const resolve of drainWaiters.splice(0)) resolve(); }
    return job?.id;
  }
  return {
    tick,
    start() { if (!timer) { stopped = false; timer = setInterval(() => { void tick(); }, 1000); timer.unref(); void tick(); } },
    stop() { stopped = true; clearInterval(timer); timer = undefined; return running ? new Promise((resolve) => drainWaiters.push(resolve)) : Promise.resolve(); },
  };
}
