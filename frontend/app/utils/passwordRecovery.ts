import type { SupabaseClient } from '@supabase/supabase-js';
export const RECOVERY_CONFIRMATION = 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.';
export function recoveryEmailValid(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function recoveryPasswordError(password: string, confirmation: string): string {
  if (password.length < 8 || password.length > 128) return 'Utiliza entre 8 y 128 caracteres.';
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return '';
}
export function recoveryRedirect(origin: string): string {
  const url = new URL(origin);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Origen no válido');
  return `${url.origin}/reset-password`;
}
export async function requestRecovery(auth: SupabaseClient['auth'], email: string, origin: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!recoveryEmailValid(normalized)) throw new Error('Introduce un correo electrónico válido.');
  const {error} = await auth.resetPasswordForEmail(normalized, {redirectTo:recoveryRedirect(origin)});
  // Auth account-specific errors receive the same answer as an accepted request.
  if (error && (error.status === 429 || !error.status || error.status >= 500)) throw new Error('No se pudo enviar la solicitud. Espera un momento y vuelve a intentarlo.');
  return RECOVERY_CONFIRMATION;
}
export async function updateRecoveryPassword(auth: SupabaseClient['auth'], userId: string | null, password: string, confirmation: string): Promise<void> {
  const validation = recoveryPasswordError(password, confirmation);
  if (validation) throw new Error(validation);
  if (!userId) throw new Error('El enlace no es válido o ha caducado. Solicita uno nuevo.');
  const {data,error} = await auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('El enlace no es válido o ha caducado. Solicita uno nuevo.');
  const result = await auth.updateUser({password});
  if (result.error) throw new Error('No se pudo cambiar la contraseña. El enlace puede haber caducado o la contraseña no cumple la política de seguridad.');
}
