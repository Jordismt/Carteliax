import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";
import { supabaseAdmin } from "./infrastructure/database/supabase.js";
import { TranslationRepository } from "./modules/translations/translationRepository.js";
import { GroqTranslationProvider } from "./modules/translations/groqTranslationProvider.js";
import { createTranslationWorker } from "./modules/translations/translationWorker.js";

let worker;
if (env.TRANSLATIONS_ENABLED && env.GROQ_API_KEY) {
  worker = createTranslationWorker({
    repository: new TranslationRepository(supabaseAdmin),
    provider: new GroqTranslationProvider({ apiKey: env.GROQ_API_KEY, model: env.GROQ_TRANSLATION_MODEL }),
  });
}

const server = app.listen(env.PORT, () => {
  console.log(`Carteliax API running on http://localhost:${env.PORT}`);
  worker?.start();
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
