<script setup lang="ts">
import { requestRecovery } from '~/utils/passwordRecovery';
useSeoMeta({title:'Recuperar contraseña | Carteliax',robots:'noindex, nofollow'});
const { $supabase } = useNuxtApp();
const email = ref(''), loading = ref(false), message = ref(''), error = ref('');
async function submit() {
  if (loading.value) return;
  loading.value = true; error.value = ''; message.value = '';
  try { message.value = await requestRecovery($supabase.auth,email.value,window.location.origin); }
  catch (err) { error.value = err instanceof Error ? err.message : 'No se pudo enviar la solicitud.'; }
  finally { loading.value = false; }
}
</script>
<template>
  <UiAuthFrame>
    <h1 class="ui-title">Recuperar contraseña</h1>
    <p class="mt-3 text-slate-500">Te enviaremos un enlace para elegir una nueva contraseña.</p>
    <form class="mt-6 space-y-5" :aria-busy="loading" @submit.prevent="submit">
      <div><label for="recovery-email" class="mb-2 block text-sm font-semibold text-slate-700">Correo electrónico</label>
        <input id="recovery-email" v-model="email" type="email" required maxlength="254" autocomplete="email" class="form-input" /></div>
      <p v-if="message" role="status" class="rounded-xl bg-emerald-50 p-4 text-emerald-800">{{ message }}</p>
      <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-red-700">{{ error }}</p>
      <button type="submit" :disabled="loading" class="ui-primary w-full">{{ loading ? 'Enviando…' : 'Enviar enlace de recuperación' }}</button>
    </form>
    <p class="mt-6 text-center"><NuxtLink to="/login" class="font-semibold text-emerald-700 hover:underline">Volver a iniciar sesión</NuxtLink></p>
  </UiAuthFrame>
</template>
