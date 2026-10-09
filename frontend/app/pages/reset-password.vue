<script setup lang="ts">
import { updateRecoveryPassword } from '~/utils/passwordRecovery';
useSeoMeta({title:'Nueva contraseña | Carteliax',robots:'noindex, nofollow',referrer:'no-referrer'});
const { $supabase } = useNuxtApp();
const recoveryUser = useState<string | null>('recovery-user', () => null);
const password = ref(''), confirmation = ref(''), loading = ref(false), checking = ref(true), done = ref(false), error = ref('');
onMounted(async () => {
  // The SDK validates implicit recovery callbacks. A custom email template can
  // instead send token_hash, which must be verified as recovery by Supabase.
  const url = new URL(window.location.href);
  try {
    if (url.searchParams.has('error') || new URLSearchParams(url.hash.slice(1)).has('error')) throw new Error('invalid');
    if (url.searchParams.get('token_hash')) {
      if (url.searchParams.get('type') !== 'recovery') throw new Error('invalid');
      const result = await $supabase.auth.verifyOtp({token_hash:url.searchParams.get('token_hash')!,type:'recovery'});
      if (result.error || !result.data.user) throw new Error('invalid');
      recoveryUser.value = result.data.user.id;
    } else if (url.searchParams.get('code')) {
      // exchangeCodeForSession emits PASSWORD_RECOVERY only for a recovery verifier.
      const result = await $supabase.auth.exchangeCodeForSession(url.searchParams.get('code')!);
      if (result.error) throw new Error('invalid');
    }
    await $supabase.auth.getSession(); // wait for SDK URL initialization/events
    // Implicit callbacks are notified by the SDK on the next task, after
    // getSession resolves. Wait for that verified event, never trust URL type alone.
    if (!recoveryUser.value) await new Promise<void>(resolve => {
      const stop = watch(recoveryUser, value => { if (value) {clearTimeout(timer);stop();resolve();} });
      const timer = window.setTimeout(() => {stop();resolve();},1500);
    });
    if (!recoveryUser.value) throw new Error('invalid');
  } catch { recoveryUser.value = null; error.value = 'El enlace no es válido, ha caducado o ya se ha utilizado. Solicita uno nuevo.'; }
  finally {
    // Remove tokens/errors without forwarding arbitrary query/return URLs.
    window.history.replaceState({}, '', '/reset-password'); checking.value = false;
  }
});
async function submit() {
  if (loading.value || checking.value || done.value) return;
  loading.value = true; error.value = '';
  try {
    await updateRecoveryPassword($supabase.auth,recoveryUser.value,password.value,confirmation.value);
    recoveryUser.value = null; password.value = ''; confirmation.value = ''; done.value = true;
    const {error:signOutError} = await $supabase.auth.signOut({scope:'global'});
    if (signOutError) error.value = 'La contraseña se ha cambiado, pero no se pudo cerrar todas las sesiones. Cierra la sesión desde el panel.';
  } catch (err) { error.value = err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.'; }
  finally { loading.value = false; }
}
</script>
<template>
  <UiAuthFrame>
    <h1 class="ui-title">Nueva contraseña</h1>
    <p v-if="checking" role="status" class="mt-5 text-slate-600">Comprobando el enlace…</p>
    <p v-if="done" role="status" class="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">Tu contraseña se ha cambiado. Inicia sesión con la nueva contraseña.</p>
    <p v-if="error" role="alert" class="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{{ error }}</p>
    <form v-if="!checking && recoveryUser && !done" class="mt-6 space-y-5" :aria-busy="loading" @submit.prevent="submit">
      <div><label for="new-password" class="mb-2 block text-sm font-semibold text-slate-700">Nueva contraseña</label><input id="new-password" v-model="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password" aria-describedby="password-help" class="form-input" /><p id="password-help" class="mt-2 text-sm text-slate-600">Entre 8 y 128 caracteres. Evita contraseñas que hayas utilizado antes.</p></div>
      <div><label for="confirm-password" class="mb-2 block text-sm font-semibold text-slate-700">Repetir contraseña</label><input id="confirm-password" v-model="confirmation" type="password" required minlength="8" maxlength="128" autocomplete="new-password" class="form-input" /></div>
      <button type="submit" :disabled="loading" class="ui-primary w-full">{{ loading ? 'Guardando…' : 'Guardar nueva contraseña' }}</button>
    </form>
    <p v-if="!checking && !recoveryUser && !done" class="mt-5"><NuxtLink to="/forgot-password" class="font-semibold text-emerald-700 underline">Solicitar un nuevo enlace</NuxtLink></p>
    <p class="mt-6 text-center"><NuxtLink to="/login" class="font-semibold text-emerald-700 hover:underline">Volver a iniciar sesión</NuxtLink></p>
  </UiAuthFrame>
</template>
