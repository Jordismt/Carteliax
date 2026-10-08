// Deliberately no translation service, provider or worker import in public code.
// This extension reads persisted publications, with DB-level visibility filters.
export async function getPersistedPublicLanguages(db, menuId, logger = console) {
  const { data, error } = await db.rpc("cx_public_translations", { p_menu: menuId });
  if (error) {
    logger.error("[PUBLIC_LANGUAGES_READ_FAILED]", { menuId, code: error.code });
    // An unavailable translations store must not break an existing public menu.
    return undefined;
  }
  return data ?? undefined;
}
