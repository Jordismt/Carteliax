// A bounded drain removes startup/polling delays without relying on process
// timers. Every invocation keeps the same in-flight promise alive. SQL claims
// and tokens remain authoritative across different instances.
export function createTranslationScheduler(worker, { keepAlive, deadline = () => undefined }) {
  let pending;
  async function drain() {
    for (let count = 0; count < 20; count++) {
      const endsAt = deadline();
      if (endsAt && endsAt.getTime() - Date.now() < 75000) return;
      if (!await worker.tick()) return;
    }
  }
  return function schedule() {
    if (!worker) return;
    if (!pending) pending = drain().finally(() => { pending = undefined; });
    keepAlive(pending);
    return pending;
  };
}
