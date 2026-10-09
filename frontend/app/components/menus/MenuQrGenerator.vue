<script setup lang="ts">
import { ExternalLink } from "lucide-vue-next";
import { publicMenuPath, publicSitePath } from "~/utils/publicUrls";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const props = withDefaults(
  defineProps<{
    publicSlug?: string;
    generalOnly?: boolean;
    businessId: string;
    slug: string;
    restaurantName: string;
    menuName: string;
    logoUrl?: string | null;
    publicBaseUrl?: string;
  }>(),
  {
    logoUrl: null,
    publicBaseUrl: "",
  },
);

const canvasRef = ref<HTMLCanvasElement | null>(null);

const primaryColor = ref("#111827");
const backgroundColor = ref("#FFFFFF");
const includeLogo = ref(true);

const generating = ref(false);
const errorMessage = ref("");
const copied = ref(false);
const downloadFeedback = ref("");

const origin = ref("");

onMounted(() => {
  origin.value = window.location.origin;
});

const publicUrl = computed(() => {
  const base = (props.publicBaseUrl || origin.value).replace(/\/+$/, "");

  if (!base || (props.generalOnly ? !props.publicSlug : !props.slug)) {
    return "";
  }

  const path = props.generalOnly ? publicSitePath(props.publicSlug!) : publicMenuPath(props.businessId, props.slug, props.publicSlug);
  return `${base}${path}`;
});

const safeFileName = computed(() => {
  return (
    props.restaurantName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "restaurante"
  );
});

async function drawLogo(canvas: HTMLCanvasElement): Promise<void> {
  if (!props.logoUrl || !includeLogo.value) {
    return;
  }

  const image = new Image();
  image.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject();
    image.src = props.logoUrl!;
  });

  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  const size = canvas.width * 0.17;
  const padding = canvas.width * 0.018;

  const x = (canvas.width - size) / 2;
  const y = (canvas.height - size) / 2;

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(x - padding, y - padding, size + padding * 2, size + padding * 2, 12);
  ctx.fill();

  ctx.save();

  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.clip();

  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);

  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;

  ctx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);

  ctx.restore();
}

async function generateCanvas(target: HTMLCanvasElement, size = 1200): Promise<void> {
  if (!publicUrl.value) {
    throw new Error("Falta el identificador del restaurante o de la carta.");
  }

  await QRCode.toCanvas(target, publicUrl.value, {
    width: size,
    margin: 4,
    errorCorrectionLevel: "H",
    color: {
      dark: primaryColor.value,
      light: backgroundColor.value,
    },
  });

  // Si el logotipo no se puede cargar, conservamos
  // el QR original sin modificar.
  if (props.logoUrl && includeLogo.value) {
    try {
      await drawLogo(target);
    } catch {
      console.warn("No se pudo cargar el logotipo. Se utilizará el QR normal.");
    }
  }
}

async function refreshQr() {
  if (!canvasRef.value || !publicUrl.value) {
    return;
  }

  generating.value = true;
  errorMessage.value = "";

  try {
    await generateCanvas(canvasRef.value, 500);
  } catch (error) {
    console.error(error);
    errorMessage.value = "No se pudo generar el QR.";
  } finally {
    generating.value = false;
  }
}

watch(
  [publicUrl, primaryColor, backgroundColor, includeLogo, () => props.logoUrl],
  () => {
    void refreshQr();
  },
  { flush: "post" },
);

function createExportCanvas() {
  return document.createElement("canvas");
}

async function downloadPng() {
  if (generating.value || !publicUrl.value) return;
  generating.value = true;
  errorMessage.value = "";

  try {
    const canvas = createExportCanvas();

    await generateCanvas(canvas, 2000);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

    if (!blob) {
      throw new Error("No se pudo generar el PNG.");
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `carteliax-${safeFileName.value}.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    downloadFeedback.value = "PNG preparado. Puedes encontrarlo en las descargas de tu navegador.";
  } catch (error) {
    console.error(error);
    errorMessage.value = "Error al descargar el PNG.";
  } finally {
    generating.value = false;
  }
}

async function downloadPdf() {
  if (generating.value || !publicUrl.value) return;
  generating.value = true;
  errorMessage.value = "";

  try {
    const canvas = createExportCanvas();

    await generateCanvas(canvas, 1600);

    const image = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 210, 297, "F");

    pdf.setTextColor(17, 24, 39);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);

    const restaurantLines = pdf.splitTextToSize(props.restaurantName, 170);

    pdf.text(restaurantLines, pageWidth / 2, 45, {
      align: "center",
    });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(13);
    pdf.setTextColor(75, 85, 99);

    pdf.text("ESCANEA Y DESCUBRE NUESTRA CARTA", pageWidth / 2, 83, { align: "center" });

    pdf.addImage(image, "PNG", 35, 99, 140, 140);

    pdf.setFontSize(13);
    pdf.text("Apunta con la camara de tu movil", pageWidth / 2, 252, { align: "center" });

    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 120);
    pdf.text("Web y carta digital", pageWidth / 2, 278, { align: "center" });

    pdf.save(`carteliax-${safeFileName.value}.pdf`);
    downloadFeedback.value = "PDF preparado. Puedes encontrarlo en las descargas de tu navegador.";
  } catch (error) {
    console.error(error);
    errorMessage.value = "Error al descargar el PDF.";
  } finally {
    generating.value = false;
  }
}

async function copyLink() {
  if (!publicUrl.value) return;

  try {
    await navigator.clipboard.writeText(publicUrl.value);
    copied.value = true;

    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    errorMessage.value = "No se pudo copiar el enlace.";
  }
}

onMounted(() => {
  void nextTick(refreshQr);
});
</script>

<template>
  <section class="ui-panel qr-generator mx-auto w-full max-w-4xl">
    <p v-if="generalOnly && !publicSlug" role="alert" class="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">La dirección de tu web todavía no está disponible. Revisa la configuración de tu establecimiento antes de descargar el QR. Los QR que ya hayas impreso siguen funcionando.</p>
    <div class="grid items-start gap-6 md:grid-cols-2">
      <div class="qr-preview flex min-w-0 flex-col items-center">
        <h2 class="text-center text-xl font-semibold">{{ restaurantName }}</h2>
        <p class="mt-1 text-center text-sm text-slate-600">Tu QR permanente</p>
        <div class="my-4 flex aspect-square w-full max-w-72 items-center justify-center bg-white">
          <canvas ref="canvasRef" class="aspect-square h-auto w-full" aria-label="Código QR de tu restaurante" role="img" />
        </div>
        <p v-if="downloadFeedback" role="status" class="mb-3 text-center text-sm text-emerald-800">{{ downloadFeedback }}</p>
        <p v-if="generating" role="status" class="mb-3 text-sm text-slate-600">Preparando QR…</p>
        <div class="grid w-full gap-2">
          <button type="button" :disabled="generating || !publicUrl" class="ui-primary" @click="downloadPdf">{{ generating ? 'Preparando QR…' : 'Descargar PDF para imprimir' }}</button>
          <button type="button" :disabled="generating || !publicUrl" class="ui-secondary" @click="downloadPng">{{ generating ? 'Preparando QR…' : 'Descargar PNG' }}</button>
          <a v-if="publicUrl" :href="publicUrl" target="_blank" rel="noopener noreferrer" class="ui-quiet">{{ generalOnly ? 'Ver mi web' : 'Ver esta carta' }} <ExternalLink :size="16" /></a>
        </div>
      </div>
      <div class="min-w-0">
        <div class="qr-share-panel"><p class="ui-eyebrow">COMPARTE CON TUS CLIENTES</p><h3 class="font-semibold">{{ generalOnly ? 'Un QR para todas tus cartas' : 'Un QR para esta carta' }}</h3><p class="ui-description mb-5">{{ generalOnly ? 'Este QR abre la web de tu restaurante y permite consultar todas tus cartas.' : 'Este QR abre directamente la carta seleccionada.' }} Puedes actualizar platos, precios e idiomas sin volver a imprimirlo.</p>        <div>
          <label for="qr-public-url" class="mb-2 block text-sm font-semibold text-slate-800">{{ generalOnly ? 'Web de tu restaurante' : 'Enlace de esta carta' }}</label>

          <div class="flex gap-2">
            <input
              id="qr-public-url"
              :value="publicUrl"
              readonly
              class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600" />

            <button
              type="button"
              :disabled="!publicUrl"
              class="rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              @click="copyLink">
              {{ copied ? "¡Copiado!" : "Copiar" }}
            </button>
          </div>
        </div>

        <p v-if="copied" role="status" class="text-sm font-medium text-emerald-800">Enlace copiado. Ya puedes compartirlo.</p>

        </div>
        <details class="rounded-lg border border-slate-200">
          <summary class="cursor-pointer px-4 py-4 text-sm font-semibold text-slate-700">Personalizar QR</summary>
          <div class="qr-options grid min-w-0 grid-cols-1 gap-5 border-t border-slate-100 p-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="qr-primary-color" class="mb-2 block text-sm font-semibold text-slate-800"> Color del QR </label>

            <input
              id="qr-primary-color"
              v-model="primaryColor"
              type="color"
              class="h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1" />
          </div>

          <div>
            <label for="qr-background-color" class="mb-2 block text-sm font-semibold text-slate-800"> Fondo </label>

            <input
              id="qr-background-color"
              v-model="backgroundColor"
              type="color"
              class="h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1" />
          </div>
        </div>

        <label
          v-if="logoUrl"
          class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
          <input v-model="includeLogo" type="checkbox" class="h-4 w-4 accent-emerald-600" />

          <span class="text-sm font-medium text-slate-700"> Incluir logotipo en el QR </span>
        </label>

        <div
          class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          Utiliza colores con bastante contraste. Antes de imprimir, comprueba el QR con varios móviles,
          especialmente si incluye logotipo.
        </div>


          </div>
        </details>
        <p class="mt-4 text-sm leading-6 text-slate-600">Descarga el PDF para imprimirlo en una hoja A4, o el PNG para incluirlo en tu propio cartel.</p>
        <p class="mt-3 text-sm leading-6 text-slate-600">Antes de imprimir, escanea el QR con tu móvil y comprueba que se abre tu web.</p>
        <p v-if="errorMessage" role="alert" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{{ errorMessage }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* qrcode sets inline pixel dimensions. The preview must scale without changing exports. */
canvas { display: block; width: 100% !important; height: auto !important; max-width: 288px; aspect-ratio: 1; }
.qr-options > *, .qr-options input { min-width: 0; }
.qr-share-panel{padding:4px 0 24px}.qr-share-panel h3{font-size:17px}.qr-preview{background:#f7f8f2;border:1px solid var(--ui-border);border-radius:var(--ui-radius);padding:22px 18px}.qr-preview canvas{border:1px solid #edf0e9;border-radius:10px}.qr-generator{padding:24px}.qr-share-panel input{font-size:12px}.qr-share-panel button{background:var(--ui-accent-soft);color:var(--ui-accent);border:0;font-size:12px}.qr-generator details summary{font-size:12px}@media(max-width:639px){.qr-generator{padding:16px}.qr-preview{padding:18px 14px}}
</style>
