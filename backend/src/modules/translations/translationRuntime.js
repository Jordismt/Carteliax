import { waitUntil, getDeadline } from '@vercel/functions';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../infrastructure/database/supabase.js';
import { TranslationRepository } from './translationRepository.js';
import { GroqTranslationProvider } from './groqTranslationProvider.js';
import { createTranslationWorker } from './translationWorker.js';
import { createTranslationScheduler } from './translationScheduler.js';

export const translationWorker = env.TRANSLATIONS_ENABLED && env.GROQ_API_KEY
  ? createTranslationWorker({
    repository: new TranslationRepository(supabaseAdmin),
    provider: new GroqTranslationProvider({ apiKey: env.GROQ_API_KEY, model: env.GROQ_TRANSLATION_MODEL }),
    deadline: getDeadline,
  }) : undefined;

// Register the actual promise with the request lifetime, including when another
// request on the same instance is already processing a job. SQL claims fence
// workers on different instances. Never automatically replay processing jobs.
export const scheduleTranslation = createTranslationScheduler(translationWorker, { keepAlive: waitUntil, deadline: getDeadline });
