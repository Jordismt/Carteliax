export interface MenuLanguage { code: string; name: string; native_name: string; html_lang: string; enabled: boolean; }
export type TranslationResource = "menu" | "category" | "product" | "restaurant";
export interface TranslationText { type: TranslationResource; id: string; name: string; description: string; welcome_text: string; }
export interface TranslationDraft { name: string; description: string; welcome_text?: string; source_hash: string; is_manual: boolean; revision: number; quality_version?: string | null; }
export interface TranslationSource extends TranslationText { source_hash: string; draft: TranslationDraft | null; }
export interface LanguageStatus extends MenuLanguage { missing: number; stale: number; manualStale: number; unpublished: number; total: number; published_at: string | null; }
export interface TranslationJob { id: string; language_code: string; status: "queued" | "processing" | "completed" | "failed"; completed_items: number; total_items: number; error_code: string | null; expires_at: string; }
export interface TranslationStatusResponse {
  sourceLanguage: string; languages: LanguageStatus[];
  publicReady: boolean;
  items: TranslationSource[];
  translations: { language: string; items: TranslationSource[] }[];
  job: TranslationJob | null;
}
export interface PublicLanguages {
  source_language: string;
  available: Pick<MenuLanguage, "code" | "native_name" | "html_lang">[];
  translations: Record<string, TranslationText[]>;
}
