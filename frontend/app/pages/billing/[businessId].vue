<script setup lang="ts">
import { COMMERCIAL_PLAN } from "~/utils/commercialPlan";
import {
  ArrowLeft,
  CreditCard,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from "lucide-vue-next";

import type { BusinessSubscription } from "~/composables/useSubscription";

definePageMeta({
  middleware: "auth",
  layout: "dashboard",
});

useHead({
  title: "Facturación | Carteliax",
});

interface Business {
  id: string;
  name: string;
  slug: string;
}

const route = useRoute();
const { apiFetch } = useApi();

const {
  getSubscription,
  createCheckout,
  cancelPendingCheckout,
  openBillingPortal,
  hasAccess,
  canManageBilling,
  canStartCheckout,
  getErrorMessage,
} = useSubscription();

const businessId = computed(() => String(route.params.businessId));

const business = ref<Business | null>(null);
const subscription = ref<BusinessSubscription | null>(null);

const loading = ref(true);
const processing = ref(false);
const errorMessage = ref("");

const active = computed(() => hasAccess(subscription.value));

const showCheckout = computed(() => canStartCheckout(subscription.value));

const showPortal = computed(() => canManageBilling(subscription.value));

const trialEligible = computed(() => !subscription.value?.trial_used_at);

const checkoutSuccess = computed(() => route.query.checkout === "success");

const checkoutCancelled = computed(() => route.query.checkout === "cancelled");

const status = computed(() => {
  switch (subscription.value?.status) {
    case "active":
      return {
        title: "Suscripción activa",
        description: "Puedes gestionar las cartas, los productos y el QR de este establecimiento.",
        color: "bg-emerald-50 text-emerald-700",
      };

    case "trialing":
      return {
        title: "Prueba gratuita activa",
        description: "Ya puedes utilizar todas las funciones de este establecimiento durante tu prueba gratuita.",
        color: "bg-emerald-50 text-emerald-700",
      };

    case "checkout_pending":
      return {
        title: "Contratación pendiente",
        description: "La contratación aún está pendiente. Si ya la has completado, actualiza el estado. Si has salido del pago, puedes cancelar el intento y empezar de nuevo.",
        color: "bg-amber-50 text-amber-700",
      };

    case "past_due":
      return {
        title: "Pago pendiente",
        description: "No se ha podido completar el cobro. Abre Gestionar facturación para revisar tu tarjeta. Las funciones del establecimiento están bloqueadas hasta regularizar el pago.",
        color: "bg-amber-50 text-amber-700",
      };

    case "unpaid":
      return {
        title: "Pago no completado",
        description: "Hay un cobro sin completar. Revisa tu método de pago en Gestionar facturación para recuperar el acceso.",
        color: "bg-red-50 text-red-700",
      };

    case "paused":
      return {
        title: "Suscripción pausada",
        description: "Las funciones del establecimiento están bloqueadas. Consulta las opciones disponibles en Gestionar facturación.",
        color: "bg-amber-50 text-amber-700",
      };

    case "incomplete":
      return {
        title: "Contratación incompleta",
        description: "Falta completar el pago inicial. Consulta Gestionar facturación para revisar la suscripción existente.",
        color: "bg-amber-50 text-amber-700",
      };

    case "incomplete_expired":
      return { title: "Contratación caducada", description: "El intento anterior ha caducado. Puedes iniciar una nueva contratación.", color: "bg-slate-100 text-slate-700" };

    case "canceled":
      return {
        title: "Suscripción cancelada",
        description: "Este establecimiento ya no tiene acceso a las funciones protegidas. Puedes contratar de nuevo; una prueba ya utilizada no se repite.",
        color: "bg-slate-100 text-slate-700",
      };

    default:
      return {
        title: "Sin suscripción",
        description: "Tu establecimiento ya está creado. Activa su suscripción para gestionar sus cartas, productos y QR.",
        color: "bg-slate-100 text-slate-700",
      };
  }
});

function formatDate(value?: string | null): string {
  if (!value) return "No disponible";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No disponible";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

async function loadBilling() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const [businessResponse, subscriptionResponse] = await Promise.all([
      apiFetch<{
        success: boolean;
        business: Business;
      }>(`/api/businesses/${encodeURIComponent(businessId.value)}`),

      getSubscription(businessId.value),
    ]);

    if (!businessResponse.success || !businessResponse.business) {
      throw new Error("No se pudo obtener el establecimiento.");
    }

    business.value = businessResponse.business;
    subscription.value = subscriptionResponse;
  } catch (error) {
    console.error("Error cargando facturación:", error);

    errorMessage.value = getErrorMessage(error, "No se pudo cargar la facturación.");
  } finally {
    loading.value = false;
  }
}

async function startCheckout() {
  if (processing.value || !showCheckout.value) {
    return;
  }

  processing.value = true;
  errorMessage.value = "";

  try {
    await createCheckout(businessId.value);
  } catch (error) {
    console.error("Error creando Checkout:", error);

    errorMessage.value = getErrorMessage(error, "No se pudo iniciar el pago.");
  } finally {
    processing.value = false;
  }
}

async function retryCheckout() {
  if (processing.value) return;
  processing.value = true;
  errorMessage.value = "";
  try {
    await cancelPendingCheckout(businessId.value);
    await loadBilling();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "No se pudo cancelar el intento anterior.");
    await loadBilling();
    // loadBilling borra el error, así que lo recuperamos.
    errorMessage.value = getErrorMessage(error, "No se pudo cancelar el intento anterior.");
  } finally {
    processing.value = false;
  }
}

async function manageBilling() {
  if (processing.value || !showPortal.value) {
    return;
  }

  processing.value = true;
  errorMessage.value = "";

  try {
    await openBillingPortal(businessId.value);
  } catch (error) {
    console.error("Error abriendo portal:", error);

    errorMessage.value = getErrorMessage(error, "No se pudo abrir la gestión de facturación.");
  } finally {
    processing.value = false;
  }
}

watch(businessId, loadBilling);
onMounted(loadBilling);
</script>

<template>
  <div class="ui-page billing-page mx-auto max-w-4xl">
    <NuxtLink
      :to="`/businesses/${businessId}`"
      class="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-700">
      <ArrowLeft :size="18" />
      Volver al establecimiento
    </NuxtLink>

    <UiPageHeader title="Facturación" description="Tu suscripción, tus fechas y tus facturas, en un único lugar." eyebrow="TU PLAN EN CARTELIAX" />

    <UiSkeleton v-if="loading" label="Cargando facturación…" />

    <template v-else>
      <div
        v-if="checkoutSuccess && !active"
        role="status"
        class="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
        Has vuelto del pago seguro. Si tu suscripción todavía no aparece activa, pulsa Actualizar estado. El acceso se habilitará cuando confirmemos la contratación.
      </div>

      <div
        v-if="checkoutCancelled"
        role="status"
        class="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        Has salido del pago sin completar la contratación. Puedes retomarla desde esta pantalla.
      </div>

      <div
        v-if="errorMessage"
        role="alert"
        class="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        <AlertCircle :size="21" class="shrink-0" />
        <p>{{ errorMessage }}</p>
      </div>

      <template v-if="business">
        <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p class="text-sm text-slate-500">Establecimiento</p>

          <h2 class="mt-2 text-xl font-bold text-slate-950">
            {{ business.name }}
          </h2>

        </section>

        <section class="billing-plan overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="billing-plan-heading border-b border-slate-200 bg-white p-5 text-slate-900 sm:p-6">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p class="text-sm font-semibold text-emerald-800">PLAN CARTELIAX</p>

                <h2 class="mt-2 text-3xl font-semibold tracking-tight">
                  {{ COMMERCIAL_PLAN.monthlyPrice }}
                  <span class="text-base font-normal text-slate-600"> /mes </span>
                </h2>

                <p class="mt-2 text-sm text-slate-600">Por establecimiento · {{ COMMERCIAL_PLAN.taxLabel }} · Todas las funciones incluidas</p>
                <p v-if="showPortal" class="mt-2 max-w-lg text-sm leading-6 text-slate-600">Precio comercial para nuevas altas. Consulta el importe contratado de tu suscripción en Gestionar facturación; las suscripciones anteriores no cambian automáticamente.</p>
                <p v-if="trialEligible && !active" class="mt-4 inline-flex rounded-lg bg-emerald-400/15 px-3 py-2 text-sm font-semibold text-emerald-800">7 días de prueba gratuita</p>
              </div>


            </div>
          </div>

          <div class="space-y-5 p-5 sm:p-6">
            <div>
              <span class="inline-flex rounded-full px-4 py-2 text-sm font-bold" :class="status.color">
                {{ status.title }}
              </span>

              <p class="mt-4 text-slate-600">
                {{ status.description }}
              </p>
            </div>

            <div
              v-if="subscription?.trial_ends_at || subscription?.current_period_end"
              class="grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
              <div v-if="subscription?.trial_ends_at" class="flex items-start gap-3">
                <CalendarDays :size="21" class="text-emerald-600" />

                <div>
                  <p class="font-semibold text-slate-900">Fin de la prueba</p>

                  <p class="mt-1 text-sm text-slate-500">
                    {{ formatDate(subscription.trial_ends_at) }}
                  </p>
                </div>
              </div>

              <div v-if="subscription?.current_period_end" class="flex items-start gap-3">
                <CalendarDays :size="21" class="text-emerald-600" />

                <div>
                  <p class="font-semibold text-slate-900">{{ subscription.cancel_at_period_end ? "Fin del acceso" : subscription.status === "trialing" ? "Inicio del período de pago" : "Próxima renovación" }}</p>

                  <p class="mt-1 text-sm text-slate-500">
                    {{ formatDate(subscription.current_period_end) }}
                  </p>
                </div>
              </div>
            </div>

            <div
              v-if="subscription?.cancel_at_period_end"
              class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Has programado la cancelación. Tu suscripción terminará al finalizar el período correspondiente.
            </div>

            <div class="space-y-4 border-t border-slate-100 pt-6">
              <h3 class="font-bold text-slate-950">Tu plan incluye</h3>

              <div
                v-for="benefit in [
                  'Web del restaurante y carta digital',
                  'Varias cartas y multiidioma',
                  'Gestión de productos y categorías',
                  'Personalización visual',
                  'Un QR permanente para tu restaurante',
                  'Actualización de precios',
                ]"
                :key="benefit"
                class="flex items-center gap-3">
                <CheckCircle2 :size="19" class="shrink-0 text-emerald-600" />

                <span class="text-sm text-slate-700">
                  {{ benefit }}
                </span>
              </div>
            </div>

            <div v-if="showCheckout" class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              <template v-if="trialEligible"><strong>Hoy comienzas con 7 días gratis.</strong> Te pediremos una tarjeta en el pago seguro. Al terminar la prueba, la suscripción pasa a {{ COMMERCIAL_PLAN.monthlyLabel }} por este establecimiento, {{ COMMERCIAL_PLAN.taxLabel }}, salvo que la canceles antes.</template>
              <template v-else>Este establecimiento ya ha utilizado su prueba gratuita. La nueva suscripción cuesta <strong>{{ COMMERCIAL_PLAN.monthlyLabel }}</strong>, {{ COMMERCIAL_PLAN.taxLabel }}, desde su activación.</template>
            </div>

            <button
              v-if="showCheckout"
              type="button"
              :disabled="processing"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              @click="startCheckout">
              <LoaderCircle v-if="processing" :size="19" class="animate-spin" />

              <ShieldCheck v-else :size="19" />

              {{
                processing
                  ? "Abriendo pago seguro..."
                  : trialEligible
                    ? "Empezar 7 días gratis"
                    : `Contratar por ${COMMERCIAL_PLAN.monthlyLabel}`
              }}
            </button>

            <button
              v-if="showPortal"
              type="button"
              :disabled="processing"
              class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-4 font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
              @click="manageBilling">
              <ExternalLink :size="18" />
              Gestionar facturación
            </button>

            <NuxtLink v-if="active" :to="{ path: '/menus', query: { business: businessId } }" class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-4 font-semibold text-white hover:bg-emerald-800">Ir a las cartas del establecimiento <ExternalLink :size="18" /></NuxtLink>

            <p v-if="showPortal" class="text-sm leading-6 text-slate-600">En Gestionar facturación puedes consultar facturas, actualizar la tarjeta y gestionar la cancelación. Si la cancelación queda programada para el final del período, conservarás el acceso hasta la fecha indicada.</p>

            <div
              v-if="subscription?.status === 'checkout_pending'"
              class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Si has salido del pago sin completar la contratación, cancela este intento. Después podrás iniciar uno nuevo.
              <button type="button" :disabled="processing" class="mt-3 block rounded-lg bg-amber-700 px-4 py-2 font-bold text-white disabled:opacity-50" @click="retryCheckout">
                Cancelar intento pendiente
              </button>
            </div>
          </div>
        </section>
      </template>

      <button
        type="button"
        :disabled="loading || processing"
        class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        @click="loadBilling">
        <RefreshCw :size="18" />
        Actualizar estado
      </button>
    </template>
  </div>
</template>

<style scoped>
.billing-plan{border-radius:var(--ui-radius-lg);box-shadow:var(--ui-shadow)}.billing-plan-heading{background:#eaf1e5!important;padding:28px!important}.billing-plan-heading h2{font-size:42px;letter-spacing:-.045em;color:var(--ui-accent)}.billing-plan-heading h2 span{font-size:15px;letter-spacing:0}.billing-plan-heading>div{gap:24px}.billing-plan>div:last-child{padding:28px}.billing-plan h3{font-size:14px}.billing-plan .space-y-4.border-t{display:grid;grid-template-columns:1fr 1fr;gap:10px}.billing-plan .space-y-4.border-t h3{grid-column:1/-1}@media(max-width:639px){.billing-plan>div:last-child,.billing-plan-heading{padding:20px!important}.billing-plan .space-y-4.border-t{grid-template-columns:1fr}}
</style>
