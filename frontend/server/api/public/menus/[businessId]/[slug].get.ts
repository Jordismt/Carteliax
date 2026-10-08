import { createError, defineEventHandler, getRouterParam } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";

export default defineEventHandler(async (event) => {
  const businessId = getRouterParam(event, "businessId");
  const slug = getRouterParam(event, "slug");

  if (!businessId || !slug) {
    throw createError({
      statusCode: 400,
      message: "Parámetros no válidos.",
    });
  }

  // Configuración privada del servidor Nuxt
  const config = useRuntimeConfig(event);

  const apiBaseUrl = config.apiBaseUrl;

  const baseUrl = apiBaseUrl.replace(/\/$/, "");

  const endpoint =
    `${baseUrl}/api/public/menus/` + `${encodeURIComponent(businessId)}/` + `${encodeURIComponent(slug)}`;

  try {
    const response = await $fetch(endpoint, { timeout: 15000 });

    return response;
  } catch (error: any) {
    const statusCode = error?.response?.status ?? error?.statusCode ?? 500;

    if (statusCode === 404) {
      throw createError({
        statusCode: 404,
        message: "Esta carta no está disponible.",
      });
    }

    console.error("[PUBLIC MENU PROXY]", { statusCode });

    throw createError({
      statusCode: 502,
      message: "No se pudo cargar la carta.",
    });
  }
});
