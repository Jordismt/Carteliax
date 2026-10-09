// Present only known user-facing failures. Never echo transport, SQL or provider messages.
export function uiError(error: unknown, fallback: string): string {
  const e = error as { statusCode?: number; status?: number; data?: { code?: string; message?: string } } | null;
  const known: Record<string, string> = {
    CHECKOUT_RECONCILIATION_REQUIRED: 'No se puede confirmar el intento anterior. Contacta con soporte para reconciliarlo.',
    CHECKOUT_RECOVERY_PENDING: 'No se ha podido confirmar Checkout. Vuelve a intentarlo para recuperar la misma sesión.',
    CHECKOUT_COMPLETED: 'El Checkout ya está completado. Actualiza el estado; no inicies otro pago.',
    CHECKOUT_REJECTED: 'Stripe ha rechazado la solicitud. Puedes volver a intentarlo.',
    BILLING_ENVIRONMENT_MISMATCH: 'La referencia pertenece a otro entorno o no está verificada. Revisa la facturación.',
    BILLING_REFERENCE_UNAVAILABLE: 'La cuenta de facturación no está disponible en el entorno actual.',
    BILLING_CONFIGURATION: 'La facturación no está configurada correctamente. Contacta con soporte.',
    CX_BUSY: 'Ya se está traduciendo este establecimiento. Espera a que termine.',
    CX_LIMIT: 'Has alcanzado el límite de traducciones. Inténtalo más tarde.',
    CX_CHANGED: 'El contenido ha cambiado. Recarga y revisa la traducción.',
    CX_INCOMPLETE: 'Completa o revisa los textos pendientes antes de publicar.',
    CX_LANGUAGE: 'El idioma no está disponible o es el idioma principal.',
    CX_EXPIRED: 'La traducción ha caducado. Puedes volver a intentarlo.',
    CX_SIZE: 'Esta carta supera el tamaño permitido para traducirla de una vez.',
    CONTENT_LIMIT: 'La carta supera el tamaño permitido para traducirla de una vez.',
  };
  if (e?.data?.code && known[e.data.code]) return known[e.data.code]!;
  if (e?.data?.message === 'El producto está asociado a categorías. Desvincúlalo antes de eliminarlo.') return 'El producto está asociado a categorías. Desvincúlalo antes de eliminarlo.';
  const status = e?.statusCode ?? e?.status;
  if (status === 401) return 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
  if (status === 403) return 'No tienes permiso para realizar esta acción.';
  if (status === 402) return 'Revisa la suscripción del establecimiento para continuar.';
  if (status === 429) return 'Has realizado varias solicitudes seguidas. Espera un momento y vuelve a intentarlo.';
  if (status === 409) return 'Los datos han cambiado o la dirección ya está en uso. Revisa la información y vuelve a intentarlo.';
  if (status === 413) return 'La imagen es demasiado grande. Elige un archivo más pequeño.';
  return fallback;
}
export function authError(message: string | null): string {
  if (!message) return '';
  if (/invalid login credentials/i.test(message)) return 'El correo o la contraseña no son correctos.';
  if (/email not confirmed/i.test(message)) return 'Confirma tu correo antes de iniciar sesión.';
  if (/already registered|already been registered/i.test(message)) return 'Ya existe una cuenta con este correo. Inicia sesión.';
  if (/rate limit|too many/i.test(message)) return 'Espera un momento antes de volver a intentarlo.';
  return 'No se ha podido completar la solicitud. Revisa tus datos e inténtalo de nuevo.';
}
