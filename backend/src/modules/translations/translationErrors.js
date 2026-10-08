export class TranslationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "TranslationError";
    this.code = code;
    this.status = status;
  }
}

export function databaseError(error) {
  const errors = {
    CX_FORBIDDEN: [403, "No tienes acceso a esta carta."],
    CX_SUBSCRIPTION: [402, "Activa tu suscripción para gestionar los idiomas."],
    CX_BUSY: [409, "Ya se está traduciendo este establecimiento. Espera a que termine."],
    CX_LIMIT: [429, "Has alcanzado el límite de traducciones. Inténtalo más tarde."],
    CX_CHANGED: [409, "El contenido ha cambiado. Recarga y revisa la traducción."],
    CX_INCOMPLETE: [409, "Completa o revisa los textos pendientes antes de publicar."],
    CX_LANGUAGE: [400, "El idioma no está disponible o es el idioma principal."],
    CX_EXPIRED: [409, "La traducción ha caducado. Puedes volver a intentarlo."],
    CX_SIZE: [413, "Esta carta supera el tamaño permitido para traducirla de una vez."],
  };
  const code = Object.keys(errors).find((key) => error?.message?.includes(key));
  if (code) return new TranslationError(code, errors[code][1], errors[code][0]);
  const result = new TranslationError("TRANSLATION_STORAGE", "No se han podido guardar o consultar los idiomas. Inténtalo de nuevo.", 503);
  result.databaseCode = error?.code;
  return result;
}
