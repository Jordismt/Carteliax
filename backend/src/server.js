import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";
import { translationWorker as worker } from "./modules/translations/translationRuntime.js";

const server = app.listen(env.PORT, () => {
  console.log(`Carteliax API running on http://localhost:${env.PORT}`);
  // Vercel workers run in request lifetimes; a persistent timer is local only.
  if (!process.env.VERCEL) worker?.start();
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  // Finish the in-flight request/batch, stop before starting another billed call.
  const timeout = setTimeout(() => process.exit(0), 45000);
  timeout.unref();
  await Promise.all([worker?.stop(), new Promise((resolve) => server.close(resolve))]);
  clearTimeout(timeout);
  process.exit(0);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
