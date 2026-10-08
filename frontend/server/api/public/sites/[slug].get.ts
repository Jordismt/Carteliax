import type { PublicSiteResponse } from "../../../../app/types/publicSite";
import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";
export default defineEventHandler(async (event): Promise<PublicSiteResponse> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const menu = getQuery(event).menu;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60 || (menu !== undefined && typeof menu !== "string")) throw createError({ statusCode: 404 });
  try {
    const endpoint: string = `${useRuntimeConfig().apiBaseUrl.replace(/\/$/, "")}/api/public/sites/${encodeURIComponent(slug)}`;
    return await $fetch<PublicSiteResponse>(endpoint, { query: menu ? { menu } : {}, timeout: 15000 });
  } catch (error: any) {
    throw createError({ statusCode: error?.response?.status === 404 ? 404 : 502, message: "La web no está disponible." });
  }
});
