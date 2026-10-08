<script setup lang="ts">
import { uiError } from "~/utils/uiErrors";
import { Plus, Pencil, Trash2, ImagePlus, X, LoaderCircle, Search, Link2, Link2Off, Package, AlertCircle, CheckCircle2, Copy, UtensilsCrossed, Check, Camera, RefreshCw, ChevronDown, LayoutList } from "lucide-vue-next";
interface Category {
  id: string;
  name: string;
  sort_order: number;
}
interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  allergenIds?: number[];
}
interface Allergen {
  id: number;
  code: string;
  name_es: string;
}
type Filter = "all" | "available" | "unavailable";
type View = "all" | "category" | "catalog";
const props = defineProps<{
  businessId: string;
  categories: Category[];
  initialCategoryId?: string;
}>();
const emit = defineEmits<{
  categoryChange: [categoryId: string];
  categoryCounts: [counts: Record<string, number>];
}>();
const { apiFetch } = useApi();
const products = ref<Product[]>([]);
const allergens = ref<Allergen[]>([]);
const categoryProductIds = ref<Record<string, string[]>>({});
const selectedCategoryId = ref("");
const view = ref<View>("all");
const search = ref("");
const filter = ref<Filter>("all");
const loading = ref(true);
const loadingLinks = ref(false);
const saving = ref(false);
const busyId = ref<string | null>(null);
const busyAction = ref<string | null>(null);
const showModal = ref(false);
const showAddExisting = ref(false);
const showAdvanced = ref(false);
const moreProductId = ref<string | null>(null);
const moreProduct = computed(() => products.value.find((p) => p.id === moreProductId.value) ?? null);
const editingId = ref<string | null>(null);
const loadingEdit = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const formError = ref("");
const existingSearch = ref("");
const selectedImage = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const removeExistingImage = ref(false);
const createCategoryId = ref("");
const form = reactive({
  name: "",
  description: "",
  price: "",
  is_available: true,
  allergenIds: [] as number[],
});
const sortedCategories = computed(() => [...props.categories].sort((a, b) => a.sort_order - b.sort_order));
const selectedCategory = computed(() => props.categories.find((c) => c.id === selectedCategoryId.value));
const linkedSet = computed(() => new Set(categoryProductIds.value[selectedCategoryId.value] ?? []));
const linkedProducts = computed(() => products.value.filter((p) => linkedSet.value.has(p.id)));
const unlinkedProducts = computed(() => products.value.filter((p) => !linkedSet.value.has(p.id)));
const productMap = computed(() => new Map(products.value.map((p) => [p.id, p])));
const categoryGroups = computed(() =>
  sortedCategories.value.map((category) => ({
    category,
    products: (categoryProductIds.value[category.id] ?? [])
      .map((id) => productMap.value.get(id))
      .filter((p): p is Product => Boolean(p)),
  })),
);
const assignedIds = computed(() => new Set(Object.values(categoryProductIds.value).flat()));
const unassignedProducts = computed(() => products.value.filter((p) => !assignedIds.value.has(p.id)));
const availableCount = computed(() => linkedProducts.value.filter((p) => p.is_available).length);
const locked = computed(() => saving.value || busyId.value !== null);
const existingProducts = computed(() => {
  const term = existingSearch.value.trim().toLocaleLowerCase("es");
  return unlinkedProducts.value.filter((p) => p.name.toLocaleLowerCase("es").includes(term));
});
const visibleGroups = computed(() => {
  const term = search.value.trim().toLocaleLowerCase("es");
  const matches = (p: Product) => {
    const matchesSearch =
      p.name.toLocaleLowerCase("es").includes(term) ||
      (p.description ?? "").toLocaleLowerCase("es").includes(term);
    const matchesFilter =
      filter.value === "all" ||
      (filter.value === "available" && p.is_available) ||
      (filter.value === "unavailable" && !p.is_available);
    return matchesSearch && matchesFilter;
  };
  if (view.value === "catalog") {
    return [
      {
        id: "catalog",
        name: "Catálogo completo",
        products: products.value.filter(matches),
      },
    ];
  }
  if (view.value === "category") {
    return [
      {
        id: selectedCategoryId.value,
        name: selectedCategory.value?.name ?? "Categoría",
        products: linkedProducts.value.filter(matches),
      },
    ];
  }
  const groups = categoryGroups.value.map((group) => ({
    id: group.category.id,
    name: group.category.name,
    products: group.products.filter(matches),
  }));
  const extras = unassignedProducts.value.filter(matches);
  if (extras.length) {
    groups.push({
      id: "unassigned",
      name: "Sin categoría",
      products: extras,
    });
  }
  return groups;
});
const displayedCount = computed(() =>
  visibleGroups.value.reduce((sum, group) => sum + group.products.length, 0),
);
const totalAssignments = computed(() =>
  Object.values(categoryProductIds.value).reduce((sum, ids) => sum + ids.length, 0),
);
function getError(error: unknown, fallback: string): string {
  return uiError(error, fallback);
}
function clearMessages() {
  errorMessage.value = "";
  successMessage.value = "";
  formError.value = "";
}
function clearFilters() {
  search.value = "";
  filter.value = "all";
}
function formatPrice(price: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}
function productAllergens(product: Product) {
  const ids = new Set(product.allergenIds ?? []);
  return allergens.value.filter((a) => ids.has(a.id));
}
function revokePreview() {
  if (imagePreview.value?.startsWith("blob:")) {
    URL.revokeObjectURL(imagePreview.value);
  }
  imagePreview.value = null;
}
function emitCounts() {
  emit(
    "categoryCounts",
    Object.fromEntries(
      props.categories.map((category) => [category.id, (categoryProductIds.value[category.id] ?? []).length]),
    ),
  );
}
async function loadProducts() {
  const businessId = props.businessId;
  const response = await apiFetch<{ products: Product[] }>(`/api/businesses/${businessId}/products`);
  if (businessId === props.businessId) {
    products.value = response.products ?? [];
  }
}
async function loadAllergens() {
  const response = await apiFetch<{ allergens: Allergen[] }>("/api/allergens");
  allergens.value = response.allergens ?? [];
}
async function loadAllCategoryProducts() {
  const businessId = props.businessId;
  const ids = props.categories.map((c) => c.id);
  loadingLinks.value = true;
  try {
    const results = await Promise.all(
      ids.map(async (id) => {
        const response = await apiFetch<{ products: Product[] }>(`/api/categories/${id}/products`);
        return [id, (response.products ?? []).map((p) => p.id)] as const;
      }),
    );
    if (businessId !== props.businessId || ids.join(",") !== props.categories.map((c) => c.id).join(","))
      return;
    categoryProductIds.value = Object.fromEntries(results);
    emitCounts();
  } catch (error) {
    if (businessId === props.businessId) {
      errorMessage.value = getError(error, "No se pudieron cargar los platos de todas las categorías.");
    }
  } finally {
    if (businessId === props.businessId) {
      loadingLinks.value = false;
    }
  }
}
async function loadCategoryProducts(categoryId = selectedCategoryId.value) {
  if (!categoryId) return;
  const response = await apiFetch<{ products: Product[] }>(`/api/categories/${categoryId}/products`);
  if (props.categories.some((c) => c.id === categoryId)) {
    categoryProductIds.value = {
      ...categoryProductIds.value,
      [categoryId]: (response.products ?? []).map((p) => p.id),
    };
    emitCounts();
  }
}
async function initialize() {
  const businessId = props.businessId;
  loading.value = true;
  clearMessages();
  try {
    await Promise.all([loadProducts(), loadAllergens(), loadAllCategoryProducts()]);
    if (businessId !== props.businessId) return;
    if (!props.categories.some((c) => c.id === selectedCategoryId.value)) {
      selectedCategoryId.value =
        props.categories.find((c) => c.id === props.initialCategoryId)?.id ??
        sortedCategories.value[0]?.id ??
        "";
    }
  } catch (error) {
    errorMessage.value = getError(error, "No se pudo cargar el catálogo.");
  } finally {
    if (businessId === props.businessId) {
      loading.value = false;
    }
  }
}
async function refreshProducts() {
  if (locked.value || loading.value) return;
  await initialize();
}
watch(
  () => props.initialCategoryId,
  (id) => {
    if (id && props.categories.some((c) => c.id === id) && id !== selectedCategoryId.value) {
      const wasSelected = Boolean(selectedCategoryId.value);
      selectedCategoryId.value = id;
      if (wasSelected) {
        view.value = "category";
        clearFilters();
      }
    }
  },
  { immediate: true },
);
watch(
  () => props.categories.map((c) => c.id).join(","),
  () => {
    if (!props.categories.some((c) => c.id === selectedCategoryId.value)) {
      selectedCategoryId.value = sortedCategories.value[0]?.id ?? "";
    }
    void loadAllCategoryProducts();
  },
);
watch(selectedCategoryId, (id, previous) => {
  if (id && id !== previous && id !== props.initialCategoryId) {
    emit("categoryChange", id);
  }
});
watch(
  () => props.businessId,
  () => {
    selectedCategoryId.value = "";
    categoryProductIds.value = {};
    products.value = [];
    view.value = "all";
    void initialize();
  },
);
onMounted(initialize);
onBeforeUnmount(revokePreview);
function setView(next: View) {
  view.value = next;
  clearFilters();
  showAddExisting.value = false;
}
function chooseCategory(id: string) {
  selectedCategoryId.value = id;
  view.value = "category";
  clearFilters();
}
function resetForm() {
  form.name = "";
  form.description = "";
  form.price = "";
  form.is_available = true;
  form.allergenIds = [];
  selectedImage.value = null;
  removeExistingImage.value = false;
  revokePreview();
  formError.value = "";
}
function openCreate(categoryId?: string) {
  if (locked.value) return;
  clearMessages();
  resetForm();
  editingId.value = null;
  loadingEdit.value = false;
  showAdvanced.value = false;
  createCategoryId.value = categoryId ?? (view.value === "category" ? selectedCategoryId.value : "");
  showModal.value = true;
}
async function openEdit(product: Product) {
  if (locked.value) return;
  clearMessages();
  resetForm();
  editingId.value = product.id;
  form.name = product.name;
  form.description = product.description ?? "";
  form.price = String(product.price);
  form.is_available = product.is_available;
  form.allergenIds = [...(product.allergenIds ?? [])];
  imagePreview.value = product.image_url;
  showAdvanced.value = true;
  showModal.value = true;
  loadingEdit.value = true;
  try {
    const response = await apiFetch<{
      success: boolean;
      allergenIds: number[];
    }>(`/api/products/${product.id}/allergens`);
    if (editingId.value === product.id && showModal.value) {
      form.allergenIds = response.allergenIds ?? [];
    }
  } catch (error) {
    if (editingId.value === product.id && showModal.value) {
      formError.value = getError(error, "No se pudieron cargar los alérgenos. Reintenta antes de guardar.");
    }
  } finally {
    loadingEdit.value = false;
  }
}
function closeModal() {
  if (saving.value) return;
  showModal.value = false;
  editingId.value = null;
  resetForm();
}
function onImageChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    formError.value = "Selecciona una imagen JPEG, PNG o WebP.";
    input.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    formError.value = "La imagen no puede superar los 5 MB.";
    input.value = "";
    return;
  }
  formError.value = "";
  revokePreview();
  selectedImage.value = file;
  imagePreview.value = URL.createObjectURL(file);
  removeExistingImage.value = false;
  input.value = "";
}
function clearImage() {
  revokePreview();
  selectedImage.value = null;
  removeExistingImage.value = true;
}
async function uploadImage(productId: string, file: File) {
  const body = new FormData();
  body.append("image", file);
  await apiFetch(`/api/products/${productId}/image`, {
    method: "POST",
    body,
  });
}
async function saveProduct() {
  if (saving.value || busyId.value || loadingEdit.value) return;
  formError.value = "";
  const name = form.name.trim();
  const price = Number(form.price);
  if (name.length < 2) {
    formError.value = "El nombre debe tener al menos dos caracteres.";
    return;
  }
  if (!String(form.price).trim() || !Number.isFinite(price) || price < 0) {
    formError.value = "Introduce un precio válido.";
    return;
  }
  saving.value = true;
  let productId = editingId.value;
  let created = false;
  let linkedSuccessfully = false;
  try {
    const body = {
      name,
      description: form.description.trim() || null,
      price,
      is_available: form.is_available,
    };
    if (productId) {
      await apiFetch(`/api/products/${productId}`, {
        method: "PATCH",
        body,
      });
    } else {
      const response = await apiFetch<{ product: Product }>(`/api/businesses/${props.businessId}/products`, {
        method: "POST",
        body,
      });
      productId = response.product.id;
      created = true;
    }
    editingId.value = productId;
    await apiFetch(`/api/products/${productId}/allergens`, {
      method: "PUT",
      body: { allergenIds: [...form.allergenIds] },
    });
    if (selectedImage.value) {
      await uploadImage(productId, selectedImage.value);
    } else if (removeExistingImage.value && !created) {
      await apiFetch(`/api/products/${productId}/image`, {
        method: "DELETE",
      });
    }
    if (created && createCategoryId.value) {
      await apiFetch(`/api/categories/${createCategoryId.value}/products`, {
        method: "POST",
        body: { productId },
      });
      linkedSuccessfully = true;
    }
    await loadProducts();
    if (linkedSuccessfully) {
      await loadCategoryProducts(createCategoryId.value);
    }
    successMessage.value = created
      ? linkedSuccessfully
        ? "Plato creado y añadido a la categoría."
        : "Producto creado correctamente."
      : "Producto actualizado correctamente.";
    showModal.value = false;
    editingId.value = null;
    resetForm();
  } catch (error) {
    formError.value = getError(
      error,
      created
        ? "El producto se ha creado, pero no se completaron todos los pasos. Revisa el catálogo antes de reintentar."
        : "No se pudieron completar los cambios. Revisa el producto.",
    );
    try {
      await loadProducts();
      await loadAllCategoryProducts();
    } catch {
      // Se mantiene el error original.
    }
  } finally {
    saving.value = false;
  }
}
async function toggleAvailability(product: Product) {
  if (locked.value) return;
  busyId.value = product.id;
  busyAction.value = "availability";
  clearMessages();
  try {
    await apiFetch(`/api/products/${product.id}`, {
      method: "PATCH",
      body: { is_available: !product.is_available },
    });
    await loadProducts();
    successMessage.value = product.is_available
      ? `"${product.name}" marcado como agotado.`
      : `"${product.name}" vuelve a estar disponible.`;
  } catch (error) {
    errorMessage.value = getError(error, "No se pudo actualizar la disponibilidad.");
  } finally {
    busyId.value = null;
    busyAction.value = null;
  }
}
async function toggleCategoryLink(product: Product, categoryId = selectedCategoryId.value) {
  if (!categoryId || locked.value || loadingLinks.value) return;
  busyId.value = product.id;
  busyAction.value = "category";
  clearMessages();
  const linked = (categoryProductIds.value[categoryId] ?? []).includes(product.id);
  try {
    if (linked) {
      await apiFetch(`/api/categories/${categoryId}/products/${product.id}`, { method: "DELETE" });
    } else {
      await apiFetch(`/api/categories/${categoryId}/products`, {
        method: "POST",
        body: { productId: product.id },
      });
    }
    await loadCategoryProducts(categoryId);
    successMessage.value = linked
      ? `"${product.name}" retirado de la categoría.`
      : `"${product.name}" añadido a la categoría.`;
  } catch (error) {
    errorMessage.value = getError(error, "No se pudo actualizar la categoría.");
  } finally {
    busyId.value = null;
    busyAction.value = null;
  }
}
async function duplicateProduct(product: Product) {
  if (locked.value) return;
  const confirmed = window.confirm(
    `¿Duplicar "${product.name}"?\n\n` +
      "Se copiarán sus datos, fotografía y alérgenos. " +
      "La copia no se añadirá automáticamente a ninguna categoría.",
  );
  if (!confirmed) return;
  busyId.value = product.id;
  busyAction.value = "duplicate";
  clearMessages();
  let duplicateCreated = false;
  try {
    const response = await apiFetch<{
      success: boolean;
      message: string;
      product: Product;
    }>(`/api/products/${product.id}/duplicate`, {
      method: "POST",
    });
    if (!response.success || !response.product?.id) {
      throw new Error("El servidor no devolvió el producto duplicado.");
    }
    duplicateCreated = true;
    await loadProducts();
    view.value = "catalog";
    search.value = response.product.name;
    filter.value = "all";
    successMessage.value =
      `"${response.product.name}" se ha duplicado correctamente. ` +
      "Puedes editarlo o añadirlo a una categoría.";
  } catch (error) {
    errorMessage.value = duplicateCreated
      ? "El producto se duplicó, pero no se pudo actualizar el listado. Recarga la página."
      : getError(error, "No se pudo duplicar el producto.");
    try {
      await loadProducts();
    } catch {
      // Evitar volver a duplicar.
    }
  } finally {
    busyId.value = null;
    busyAction.value = null;
  }
}
async function deleteProduct(product: Product) {
  if (locked.value) return;
  const confirmed = window.confirm(`¿Eliminar definitivamente "${product.name}" del establecimiento?\n\nSe eliminará del catálogo. Esta acción no se puede deshacer.`);
  if (!confirmed) return;
  busyId.value = product.id;
  busyAction.value = "delete";
  clearMessages();
  try {
    await apiFetch(`/api/products/${product.id}`, {
      method: "DELETE",
    });
    await loadProducts();
    await loadAllCategoryProducts();
    successMessage.value = "Producto eliminado correctamente.";
  } catch (error) {
    errorMessage.value = getError(
      error,
      "No se pudo eliminar el producto. Puede que siga asociado a alguna categoría.",
    );
  } finally {
    busyId.value = null;
    busyAction.value = null;
  }
}
function openExisting(categoryId: string) {
  selectedCategoryId.value = categoryId;
  existingSearch.value = "";
  showAddExisting.value = true;
}
</script>
<template>
  <section class="product-manager space-y-5">
    <!-- Notificaciones -->
    <div
      v-if="successMessage"
      role="status"
      class="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      <CheckCircle2 :size="19" class="shrink-0" />
      <span class="flex-1">{{ successMessage }}</span>
      <button type="button" aria-label="Cerrar" @click="successMessage = ''">
        <X :size="17" />
      </button>
    </div>
    <div
      v-if="errorMessage"
      role="alert"
      class="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle :size="19" class="shrink-0" />
      <span class="flex-1">{{ errorMessage }}</span>
      <button type="button" aria-label="Cerrar" @click="errorMessage = ''">
        <X :size="17" />
      </button>
    </div>
    <div class="ui-panel">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold">Productos</h2>
        <button type="button" :disabled="locked || loading" class="ui-primary" aria-label="Añadir producto" @click="openCreate()"><Plus :size="18" /> <span class="sm:hidden">Añadir</span><span class="hidden sm:inline">Añadir producto</span></button>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" aria-label="Productos que quieres ver">
        <button type="button" class="product-view" :class="{ 'product-view-active': view === 'all' }" :aria-pressed="view === 'all'" @click="setView('all')">Por categorías</button>
        <button type="button" :disabled="!selectedCategoryId" class="product-view" :class="{ 'product-view-active': view === 'category' }" :aria-pressed="view === 'category'" @click="setView('category')">Categoría</button>
        <button type="button" class="product-view" :class="{ 'product-view-active': view === 'catalog' }" :aria-pressed="view === 'catalog'" @click="setView('catalog')">Todo el negocio</button>
      </div>
      <p v-if="view === 'catalog'" class="mt-3 text-sm text-slate-600">También incluye productos que no has añadido a esta carta.</p>
      <div v-if="view === 'category'" class="mt-3 flex flex-wrap items-end gap-2">
        <div class="min-w-0 flex-1">
          <label for="product-category-filter" class="mb-1 block text-sm font-semibold">Categoría</label>
          <select id="product-category-filter" :value="selectedCategoryId" class="w-full rounded-lg border border-slate-200 px-3 py-2" @change="chooseCategory(($event.target as HTMLSelectElement).value)">
            <option v-for="category in sortedCategories" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>
        </div>
        <button v-if="selectedCategoryId" type="button" :disabled="locked || loadingLinks" class="ui-secondary" @click="openExisting(selectedCategoryId)">Añadir existente</button>
      </div>
      <div class="relative mt-4 min-w-0">
        <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input v-model="search" type="search" aria-label="Buscar productos por nombre o descripción" placeholder="Buscar un producto…" class="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-3" />
      </div>
      <div class="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <p class="min-w-0 flex-1">{{ displayedCount }} {{ displayedCount === 1 ? 'resultado' : 'resultados' }}</p>
        <select v-model="filter" aria-label="Filtrar disponibilidad" class="min-w-0 max-w-36 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
          <option value="all">Todos</option><option value="available">Disponibles</option><option value="unavailable">Agotados</option>
        </select>
        <button type="button" :disabled="locked || loading" class="ui-quiet p-2" aria-label="Actualizar productos" @click="refreshProducts"><RefreshCw :size="18" :class="{ 'animate-spin': loading }" /></button>
      </div>
    </div>
    <!-- Carga -->
    <UiSkeleton v-if="loading || loadingLinks" label="Cargando productos…" :count="3" />
    <div v-else-if="errorMessage && products.length === 0" class="ui-panel">
      <h3 class="text-lg font-semibold">No hemos podido cargar los productos</h3>
      <p class="ui-description">Inténtalo de nuevo para consultar los productos del establecimiento.</p>
      <button type="button" :disabled="locked" class="ui-secondary mt-4" @click="refreshProducts">Reintentar</button>
    </div>
    <!-- Sin resultados -->
    <div
      v-else-if="displayedCount === 0 && (search || filter !== 'all' || view !== 'all' || !visibleGroups.length)"
      class="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-14 text-center">
      <UtensilsCrossed :size="32" class="mx-auto text-slate-300" />
      <h3 class="mt-4 text-lg font-extrabold text-slate-900">
        {{ search || filter !== "all" ? "No hay resultados" : view === "category" ? "Esta categoría todavía está vacía" : "Todavía no hay productos" }}
      </h3>
      <p class="mt-2 text-sm text-slate-500">
        {{
          search || filter !== "all"
            ? "Prueba otra búsqueda o cambia el filtro."
            : "Crea un producto para empezar a completar tu carta."
        }}
      </p>
      <button
        v-if="search || filter !== 'all'"
        type="button"
        class="mt-5 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold"
        @click="clearFilters">
        Limpiar filtros
      </button>
      <button
        v-else
        type="button"
        class="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white"
        @click="openCreate()">
        Añadir producto
      </button>
    </div>
    <!-- Grupos y productos -->
    <div v-else class="space-y-6">
      <section v-for="group in visibleGroups" :key="group.id" class="space-y-2">
        <div
          v-if="view === 'all'"
          class="flex flex-wrap items-center justify-between gap-2 px-1 py-2">
          <div>
            <h3 class="text-lg font-black text-slate-950">
              {{ group.id === 'unassigned' ? 'Sin categoría en esta carta' : group.name }}
            </h3>
            <p class="mt-1 text-xs text-slate-500">
              {{ group.products.length }}
              {{ group.products.length === 1 ? "producto" : "productos" }}
            </p>
          </div>
          <div v-if="group.id !== 'unassigned'" class="flex flex-wrap gap-2">
            <button
              type="button"
              :disabled="locked"
              class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              @click="openExisting(group.id)">
              Añadir existente
            </button>
            <button
              type="button"
              :disabled="locked"
              class="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              @click="openCreate(group.id)">
              <Plus :size="14" class="mr-1 inline" />
              Añadir producto
            </button>
          </div>
        </div>
        <div
          v-if="!group.products.length"
          class="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
          <p class="font-semibold text-slate-700">Esta categoría todavía está vacía.</p><p class="mt-2 text-sm text-slate-500">Añade un producto nuevo o elige uno que ya tengas en tu negocio.</p>
        </div>
        <article
          v-for="product in group.products"
          :key="`${group.id}-${product.id}`"
          class="product-row overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div class="product-main flex gap-3 p-3 sm:p-4">
            <img
              v-if="product.image_url"
              :src="product.image_url"
              :alt="product.name"
              loading="lazy"
              class="h-14 w-14 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16" />
            <div
              v-else
              class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-50 sm:h-16 sm:w-16">
              <ImagePlus :size="26" class="text-slate-300" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <h3 class="break-words text-base font-extrabold text-slate-950 sm:text-lg">
                  {{ product.name }}
                </h3>
                <span
                  class="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  :class="
                    product.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  ">
                  {{ product.is_available ? "Disponible" : "Agotado" }}
                </span>
              </div>
              <p class="mt-1 text-base font-semibold tabular-nums text-slate-900">
                {{ formatPrice(Number(product.price)) }}
              </p>
              <p v-if="product.description" class="mt-1 line-clamp-1 text-sm leading-relaxed text-slate-500">
                {{ product.description }}
              </p>
              <div v-if="productAllergens(product).length" class="mt-2 flex flex-wrap gap-1">
                <span
                  v-for="allergen in productAllergens(product)"
                  :key="allergen.id"
                  class="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                  {{ allergen.name_es }}
                </span>
              </div>
              <span
                v-if="view === 'catalog' && linkedSet.has(product.id)"
                class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <Check :size="13" />
                En la categoría seleccionada
              </span>
            </div>
          </div>
          <!-- Acciones -->
          <div class="product-actions flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              :disabled="locked"
              class="ui-secondary flex-1 px-3"
              @click="openEdit(product)">
              <Pencil :size="14" />
              Editar
            </button>
            <button
              type="button"
              :disabled="locked"
              class="ui-secondary flex-1 px-3"
              @click="toggleAvailability(product)">
              <LoaderCircle
                v-if="busyId === product.id && busyAction === 'availability'"
                :size="13"
                class="mr-1 inline animate-spin" />
              {{ product.is_available ? "Marcar agotado" : "Disponible de nuevo" }}
            </button>
            <button
              v-if="group.id !== 'unassigned' && group.id !== 'catalog'"
              type="button"
              :disabled="locked || loadingLinks"
              class="ui-quiet px-2 text-xs"
              @click="toggleCategoryLink(product, group.id)">
              <Link2Off :size="14" />
              Retirar de categoría
            </button>
            <button
              v-else-if="view === 'catalog' && selectedCategoryId"
              type="button"
              :disabled="locked || loadingLinks"
              class="ui-quiet px-2 text-xs"
              @click="toggleCategoryLink(product)">
              <Link2Off v-if="linkedSet.has(product.id)" :size="14" />
              <Link2 v-else :size="14" />
              {{ linkedSet.has(product.id) ? "Retirar de categoría" : "Añadir a categoría" }}
            </button>
            <button
              type="button"
              :disabled="locked"
              class="ui-quiet ml-auto px-2 text-xs"
              :aria-label="`Más opciones para ${product.name}`"
              @click="moreProductId = product.id">
              Más
              <ChevronDown :size="14" />
            </button>
          </div>
        </article>
      </section>
    </div>
    <!-- Opciones de producto: diálogo independiente para evitar recortes -->
    <div
      v-if="moreProduct"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
      @click.self="moreProductId = null">
      <section
        v-dialog-accessibility="() => { moreProductId = null }"
        role="dialog"
        aria-modal="true"
        :aria-label="`Más opciones para ${moreProduct.name}`"
        class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-xs font-bold uppercase tracking-wide text-emerald-700">Opciones del producto</p>
            <h3 class="mt-1 break-words text-lg font-black text-slate-900">{{ moreProduct.name }}</h3>
          </div>
          <button
            type="button"
            aria-label="Cerrar opciones"
            class="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            @click="moreProductId = null">
            <X :size="19" />
          </button>
        </div>
        <div class="mt-5 space-y-2">
          <button
            type="button"
            :disabled="locked"
            class="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            @click="
              duplicateProduct(moreProduct);
              moreProductId = null;
            ">
            <Copy :size="18" class="shrink-0" />
            Duplicar producto
          </button>
          <button
            type="button"
            :disabled="locked"
            class="flex w-full items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-left text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            @click="
              deleteProduct(moreProduct);
              moreProductId = null;
            ">
            <Trash2 :size="18" class="shrink-0" />
            Eliminar definitivamente
          </button>
        </div>
        <button
          type="button"
          class="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          @click="moreProductId = null">
          Cancelar
        </button>
      </section>
    </div>
    <!-- Modal de productos existentes -->
    <div
      v-if="showAddExisting"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3"
      @click.self="showAddExisting = false">
      <section
        v-dialog-accessibility="() => { showAddExisting = false }"
        role="dialog"
        aria-modal="true"
        aria-labelledby="existing-title"
        class="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 id="existing-title" class="text-xl font-black text-slate-950">Añadir productos existentes</h2>
            <p class="mt-1 text-sm text-slate-500">
              Selecciona los productos que quieres mostrar en
              {{ selectedCategory?.name }}.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            class="rounded-lg p-2 hover:bg-slate-100"
            @click="showAddExisting = false">
            <X :size="20" />
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <div class="relative">
            <Search :size="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="existingSearch"
              type="search"
              aria-label="Buscar productos del catálogo"
              placeholder="Buscar producto existente..."
              class="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-emerald-500" />
          </div>
          <div v-if="loadingLinks" class="py-10 text-center text-sm text-slate-500">
            Actualizando productos...
          </div>
          <div v-else-if="!existingProducts.length" class="py-12 text-center text-sm text-slate-500">
            No hay más productos para añadir.
          </div>
          <div v-else class="mt-4 space-y-2">
            <div
              v-for="product in existingProducts"
              :key="product.id"
              class="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.name"
                class="h-12 w-12 shrink-0 rounded-lg object-cover" />
              <div v-else class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <UtensilsCrossed :size="19" class="text-slate-300" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-slate-900">
                  {{ product.name }}
                </p>
                <p class="text-xs text-slate-500">
                  {{ formatPrice(Number(product.price)) }}
                </p>
              </div>
              <button
                type="button"
                :disabled="locked || loadingLinks"
                class="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                @click="toggleCategoryLink(product)">
                <LoaderCircle v-if="busyId === product.id" :size="14" class="animate-spin" />
                <Plus v-else :size="14" />
                Añadir
              </button>
            </div>
          </div>
        </div>
        <footer class="border-t border-slate-100 p-4 text-right">
          <button
            type="button"
            class="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
            @click="showAddExisting = false">
            Terminar
          </button>
        </footer>
      </section>
    </div>
    <!-- Panel de creación y edición -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex justify-end bg-slate-950/60"
      @click.self="closeModal">
      <section
        v-dialog-accessibility="closeModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        class="product-dialog flex h-dvh w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header
          class="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-8">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-emerald-600">
              {{ editingId ? "Modificar producto" : "Añadir producto" }}
            </p>
            <h2 id="product-modal-title" class="mt-1 text-2xl font-black text-slate-950">
              {{ editingId ? "Editar producto" : "Crear producto" }}
            </h2>
          </div>
          <button
            type="button"
            :disabled="saving"
            aria-label="Cerrar formulario"
            class="rounded-xl p-2 hover:bg-slate-100 disabled:opacity-50"
            @click="closeModal">
            <X :size="21" />
          </button>
        </header>
        <form
          id="product-form"
          class="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8"
          @submit.prevent="saveProduct">
          <section class="space-y-5">
            <div>
              <label for="product-name" class="mb-2 block text-sm font-bold text-slate-700">
                Nombre del producto *
              </label>
              <input
                id="product-name"
                v-model="form.name"
                required
                minlength="2"
                maxlength="120"
                placeholder="Ej.: Hamburguesa completa"
                class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div v-if="!editingId">
              <label for="product-category" class="mb-2 block text-sm font-bold text-slate-700">
                Categoría
              </label>
              <select
                id="product-category"
                v-model="createCategoryId"
                class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500">
                <option value="">Sin categoría (solo catálogo)</option>
                <option v-for="category in sortedCategories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
              <p class="mt-1 text-xs text-slate-500">
                El producto se añadirá automáticamente a la categoría elegida.
              </p>
            </div>
            <div>
              <label for="product-price" class="mb-2 block text-sm font-bold text-slate-700">
                Precio *
              </label>
              <div class="relative max-w-xs">
                <input
                  id="product-price"
                  v-model="form.price"
                  type="number"
                  inputmode="decimal"
                  max="999999.99"
                  min="0"
                  step="0.01"
                  required
                  placeholder="12.50"
                  class="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none focus:border-emerald-500" />
                <span class="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400"> € </span>
              </div>
            </div>
            <div>
              <label for="product-description" class="mb-2 block text-sm font-bold text-slate-700">
                Descripción
                <span class="font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                id="product-description"
                v-model="form.description"
                rows="3"
                maxlength="1000"
                placeholder="Ingredientes o descripción del producto..."
                class="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
              <p class="mt-1 text-right text-xs text-slate-400">{{ form.description.length }}/1000</p>
            </div>
            <!-- Fotografía -->
            <div>
              <label class="mb-2 block text-sm font-bold text-slate-700"> Fotografía </label>
              <div class="overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                <div
                  v-if="imagePreview"
                  class="relative flex max-h-64 items-center justify-center bg-slate-100">
                  <img
                    :src="imagePreview"
                    alt="Vista previa de la fotografía"
                    class="max-h-64 w-full object-contain" />
                </div>
                <div v-else class="flex flex-col items-center justify-center gap-2 py-8 text-slate-400">
                  <Camera :size="32" />
                  <p class="text-sm">Añade una fotografía del producto</p>
                </div>
                <div class="flex flex-wrap items-center gap-2 p-3">
                  <label
                    class="upload-control inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                    <ImagePlus :size="16" />
                    {{ imagePreview ? "Cambiar foto" : "Seleccionar foto" }}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      :aria-label="imagePreview ? 'Cambiar foto' : 'Seleccionar foto'"
                      @change="onImageChange" />
                  </label>
                  <button
                    v-if="imagePreview"
                    type="button"
                    class="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-bold text-red-600"
                    @click="clearImage">
                    Quitar foto
                  </button>
                  <span class="text-xs text-slate-400"> JPEG, PNG o WebP · Máx. 5 MB </span>
                </div>
              </div>
            </div>
            <!-- Disponibilidad -->
            <label
              class="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4"
              :class="
                form.is_available ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
              ">
              <div>
                <p class="text-sm font-extrabold text-slate-900">
                  {{ form.is_available ? "Producto disponible" : "Producto agotado" }}
                </p>
                <p class="mt-1 text-xs text-slate-500">Cambia este estado cuando el producto se agote.</p>
              </div>
              <input v-model="form.is_available" type="checkbox" class="h-5 w-5 accent-emerald-600" />
            </label>
          </section>
          <!-- Alérgenos -->
          <section class="rounded-2xl border border-slate-200">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 p-4 text-left"
              :aria-expanded="showAdvanced"
              @click="showAdvanced = !showAdvanced">
              <div>
                <h3 class="text-sm font-extrabold text-slate-900">
                  Alérgenos
                  <span class="ml-1 font-normal text-slate-400">
                    ({{ form.allergenIds.length }} seleccionados)
                  </span>
                </h3>
                <p class="mt-1 text-xs text-slate-500">Selecciona los alérgenos presentes en el producto.</p>
              </div>
              <ChevronDown
                :size="19"
                class="shrink-0 text-slate-500 transition"
                :class="{ 'rotate-180': showAdvanced }" />
            </button>
            <div v-if="showAdvanced" class="border-t border-slate-100 p-4">
              <div v-if="loadingEdit" class="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle :size="17" class="animate-spin" />
                Cargando alérgenos...
              </div>
              <div v-else class="grid gap-2 sm:grid-cols-2">
                <label
                  v-for="allergen in allergens"
                  :key="allergen.id"
                  class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                  :class="
                    form.allergenIds.includes(allergen.id)
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 text-slate-600'
                  ">
                  <span class="font-semibold">
                    {{ allergen.name_es }}
                  </span>
                  <input
                    v-model="form.allergenIds"
                    type="checkbox"
                    :value="allergen.id"
                    class="h-4 w-4 accent-emerald-600" />
                </label>
              </div>
              <p class="mt-4 text-xs leading-relaxed text-slate-500">
                Comprueba siempre los ingredientes y la información de tus proveedores.
              </p>
            </div>
          </section>
          <div
            v-if="formError"
            role="alert"
            class="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle :size="18" class="shrink-0" />
            {{ formError }}
          </div>
        </form>
        <footer
          class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-8">
          <button
            type="button"
            :disabled="saving"
            class="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 disabled:opacity-50"
            @click="closeModal">
            Cancelar
          </button>
          <button
            type="submit"
            form="product-form"
            :disabled="saving || loadingEdit"
            class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50">
            <LoaderCircle v-if="saving" :size="17" class="animate-spin" />
            <Check v-else :size="17" />
            {{ saving ? "Guardando..." : editingId ? "Guardar cambios" : "Añadir producto" }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.product-view { min-height: 44px; min-width: 0; border-radius: 6px; padding: 8px 6px; font-size: 12px; font-weight: 600; line-height: 1.4; color: #475569; }
.product-view-active { background: white; color: #065f46; box-shadow: 0 1px 3px rgb(15 23 42 / .08); }
.product-view:disabled { opacity: .5; }
</style>
