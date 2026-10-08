import { createError, defineEventHandler, getRouterParam } from "h3";
import { fetchPublicApi } from "../../../../utils/publicApiProxy";

export default defineEventHandler(async (event) => {
  const businessId = getRouterParam(event, "businessId");
  const slug = getRouterParam(event, "slug");

  if (!businessId || !slug) {
    throw createError({
      statusCode: 400,
      message: "Parámetros no válidos.",
    });
  }

  return fetchPublicApi(event, `/api/public/menus/${encodeURIComponent(businessId)}/${encodeURIComponent(slug)}`);
});
