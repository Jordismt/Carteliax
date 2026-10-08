<script setup lang="ts">
definePageMeta({
  middleware: "auth",
  layout: "dashboard",
});

const { apiFetch } = useApi();

const name = ref("");
const slug = ref("");
const message = ref("");
interface Business { id: string; name: string; slug: string }
const businesses = ref<Business[]>([]);
const loading = ref(false);

async function loadBusinesses() {
  try {
    const response = await apiFetch<{
      success: boolean;
      businesses: Business[];
    }>("/api/businesses");

    businesses.value = response.businesses;
  } catch (error) {
    message.value = "Error al cargar establecimientos.";
  }
}

async function createBusiness() {
  if (loading.value) return;
  loading.value = true;
  message.value = "";

  try {
    await apiFetch("/api/businesses", {
      method: "POST",
      body: {
        name: name.value,
        slug: slug.value,
        default_language: "es",
      },
    });

    message.value = "¡Establecimiento creado!";
    name.value = "";
    slug.value = "";

    await loadBusinesses();
  } catch (error: unknown) {
    const failure = error as { data?: { message?: string }; message?: string };
    message.value = failure.data?.message || failure.message || "No se ha podido crear el establecimiento.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadBusinesses);
</script>

<template>
  <main class="mx-auto max-w-xl space-y-8 p-8">
    <h1 class="text-3xl font-bold">Prueba de establecimientos</h1>

    <form class="space-y-4" @submit.prevent="createBusiness">
      <label for="test-business-name" class="block text-sm font-semibold">Nombre del restaurante</label>
      <input
        id="test-business-name"
        v-model="name"
        required
        minlength="2"
        placeholder="Nombre del restaurante"
        class="w-full rounded-lg border p-3" />

      <label for="test-business-slug" class="block text-sm font-semibold">Identificador público</label>
      <input
        id="test-business-slug"
        v-model="slug"
        required
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        placeholder="Identificador: mi-restaurante"
        class="w-full rounded-lg border p-3" />

      <button :disabled="loading" class="rounded-lg bg-emerald-600 px-6 py-3 text-white">
        {{ loading ? "Creando..." : "Crear establecimiento" }}
      </button>
    </form>

    <p aria-live="polite">{{ message }}</p>

    <section>
      <h2 class="mb-4 text-xl font-bold">Mis establecimientos</h2>

      <div v-for="business in businesses" :key="business.id" class="mb-3 rounded-lg border p-4">
        <strong>{{ business.name }}</strong>
        <p>{{ business.slug }}</p>
      </div>
    </section>
  </main>
</template>
