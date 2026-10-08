import type { PublicSiteResponse } from "../../../../app/types/publicSite";
import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";
import { fetchPublicApi } from "../../../utils/publicApiProxy";
export default defineEventHandler(async (event): Promise<PublicSiteResponse> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const menu = getQuery(event).menu;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60 || (menu !== undefined && typeof menu !== "string")) throw createError({ statusCode: 404 });
  return fetchPublicApi<PublicSiteResponse>(event, `/api/public/sites/${encodeURIComponent(slug)}`, menu ? { menu } : {});
});
