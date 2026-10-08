<script setup lang="ts">
import { authError } from "~/utils/uiErrors";
import { ref } from "vue";

useHead({
  title: "Iniciar sesión | Carteliax",
});

const { login, loading, error } = useAuth();

const email = ref("");
const password = ref("");
const showPassword = ref(false);

async function handleLogin() {
  if (loading.value) return;
  const result = await login(email.value.trim().toLowerCase(), password.value);

  if (result?.session) {
    await navigateTo("/dashboard");
  }
}
</script>

<template>
  <UiAuthFrame>
        <h1 class="ui-title">Iniciar sesión</h1>

        <p class="mt-3 text-slate-500">Accede al panel de tu establecimiento.</p>

        <form class="mt-6 space-y-5" :aria-busy="loading" @submit.prevent="handleLogin">
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
              class="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
          </div>

          <div>
            <label for="password" class="mb-2 block text-sm font-semibold text-slate-700"> Contraseña </label>

            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
                placeholder="Tu contraseña"
                class="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 pr-24 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />

              <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-700"
                :aria-pressed="showPassword"
                aria-controls="password"
                @click="showPassword = !showPassword">
                {{ showPassword ? "Ocultar" : "Mostrar" }}
              </button>
            </div>
          </div>

          <div
            v-if="error"
            role="alert"
            class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {{ authError(error) }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full rounded-xl bg-emerald-600 px-6 py-4 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            {{ loading ? "Accediendo..." : "Iniciar sesión" }}
          </button>
        </form>

        <p class="mt-8 text-center text-sm text-slate-500">
          ¿Todavía no tienes una cuenta?

          <NuxtLink to="/register" class="font-semibold text-emerald-700 hover:underline">
            Regístrate gratis
          </NuxtLink>
        </p>
  </UiAuthFrame>
</template>
