<script setup lang="ts">
import { COMMERCIAL_PLAN } from "~/utils/commercialPlan";
import { CheckCircle2 } from "lucide-vue-next";
import { authError } from "~/utils/uiErrors";
import { computed, ref } from "vue";

useHead({
  title: "Crear cuenta | Carteliax",
  meta: [
    {
      name: "description",
      content: "Crea tu cuenta en Carteliax y empieza a gestionar tus cartas digitales.",
    },
  ],
});

const { register, loading, error } = useAuth();

const fullName = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");

const showPassword = ref(false);
const acceptedTerms = ref(false);
const success = ref(false);
const validationError = ref("");

const passwordValid = computed(() => password.value.length >= 8);

const canSubmit = computed(
  () =>
    fullName.value.trim().length >= 2 &&
    email.value.trim().length > 0 &&
    passwordValid.value &&
    password.value === confirmPassword.value &&
    acceptedTerms.value &&
    !loading.value,
);

async function handleRegister() {
  validationError.value = "";

  if (!canSubmit.value) {
    validationError.value = "Comprueba los campos y acepta las condiciones.";
    return;
  }

  const result = await register(fullName.value.trim(), email.value.trim().toLowerCase(), password.value);

  if (!result) return;

  // No asumimos que existe una sesión.
  // Supabase puede requerir confirmar el correo.
  if (result.session) {
    await navigateTo("/dashboard");
    return;
  }

  success.value = true;
}
</script>

<template>
  <UiAuthFrame>
        <!-- REGISTRO COMPLETADO -->
        <div v-if="success" role="status" class="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div
            class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
            <CheckCircle2 :size="30" aria-hidden="true" />
          </div>

          <h1 class="mt-6 text-2xl font-bold text-slate-950">¡Revisa tu correo!</h1>

          <p class="mt-4 text-slate-500">
            Si tu registro se ha procesado correctamente, recibirás un correo para confirmar tu cuenta.
          </p>

          <NuxtLink
            to="/login"
            class="mt-8 block rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700">
            Ir a iniciar sesión
          </NuxtLink>
        </div>

        <!-- FORMULARIO DE REGISTRO -->
        <template v-else>
          <div class="mb-9">
            <h1 class="ui-title">Crea tu cuenta</h1>

            <p class="mt-3 text-slate-500">Regístrate gratis y crea tu establecimiento. Activarás su suscripción en el siguiente paso.</p>
          </div>

          <p class="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><strong>{{ COMMERCIAL_PLAN.monthlyLabel }} por establecimiento · {{ COMMERCIAL_PLAN.taxLabel }} · 7 días gratis.</strong> La tarjeta se solicita al activar la suscripción, después de crear tu negocio.</p>

          <form :aria-busy="loading" class="space-y-5" @submit.prevent="handleRegister">
            <div>
              <label for="fullName" class="mb-2 block text-sm font-semibold text-slate-700">
                Nombre completo
              </label>

              <input
                id="fullName"
                v-model="fullName"
                type="text"
                autocomplete="name"
                required
                minlength="2"
                placeholder="Tu nombre"
                class="form-input" />
            </div>

            <div>
              <label for="email" class="mb-2 block text-sm font-semibold text-slate-700">
                Correo electrónico
              </label>

              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                required
                placeholder="nombre@restaurante.com"
                class="form-input" />
            </div>

            <div>
              <label for="password" class="mb-2 block text-sm font-semibold text-slate-700">
                Contraseña
              </label>

              <div class="relative">
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  placeholder="Mínimo 8 caracteres"
                  class="form-input pr-20" />

                <button
                  type="button"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-emerald-700"
                  :aria-pressed="showPassword"
                  aria-controls="password"
                  @click="showPassword = !showPassword">
                  {{ showPassword ? "Ocultar" : "Mostrar" }}
                </button>
              </div>

              <p class="mt-2 text-xs" :class="passwordValid ? 'text-emerald-600' : 'text-slate-400'">
                Mínimo 8 caracteres
              </p>
            </div>

            <div>
              <label for="confirmPassword" class="mb-2 block text-sm font-semibold text-slate-700">
                Repetir contraseña
              </label>

              <input
                id="confirmPassword"
                :aria-invalid="!!confirmPassword && password !== confirmPassword"
                :aria-describedby="confirmPassword && password !== confirmPassword ? 'confirm-password-error' : undefined"
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                required
                placeholder="Repite tu contraseña"
                class="form-input" />

              <p id="confirm-password-error" v-if="confirmPassword && password !== confirmPassword" class="mt-2 text-xs text-red-600">
                Las contraseñas no coinciden.
              </p>
            </div>

            <label class="flex cursor-pointer items-start gap-3">
              <input v-model="acceptedTerms" type="checkbox" required class="mt-1 accent-emerald-600" />

              <span class="text-sm leading-relaxed text-slate-500">
                Acepto las condiciones de uso y la política de privacidad.
              </span>
            </label>

            <div
              v-if="validationError || error"
              role="alert"
              class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {{ validationError || authError(error) }}
            </div>

            <button
              type="submit"
              :disabled="!canSubmit"
              class="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-6 py-4 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              {{ loading ? "Creando cuenta..." : "Crear cuenta gratis" }}
            </button>
          </form>

          <p class="mt-8 text-center text-sm text-slate-500">
            ¿Ya tienes una cuenta?

            <NuxtLink to="/login" class="font-semibold text-emerald-700 hover:underline">
              Inicia sesión
            </NuxtLink>
          </p>
        </template>
  </UiAuthFrame>
</template>

<style scoped>
@reference "tailwindcss";

.form-input {
  @apply w-full rounded-xl border border-slate-200
         bg-white px-4 py-3.5 text-slate-900
         outline-none transition
         placeholder:text-slate-400
         focus:border-emerald-500
         focus:ring-4 focus:ring-emerald-500/10;
}
</style>
