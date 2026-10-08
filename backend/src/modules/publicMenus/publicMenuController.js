import { z } from "zod";

import { createPublicClient } from "../../infrastructure/database/createPublicClient.js";
import { env } from "../../config/env.js";
import { getPersistedPublicLanguages } from "./publicMenuTranslations.js";

const paramsSchema = z.object({
  businessId: z.string().uuid(),
  slug: z.string().min(1).max(150),
});

function notFound(res) {
  return res.status(404).json({
    success: false,
    message: "Esta carta no existe o no está publicada.",
  });
}

function checkError(error) {
  if (error) {
    throw error;
  }
}

// GET /api/public/menus/:businessId/:slug

export async function getPublicMenu(req, res, next) {
  try {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) return notFound(res);
    const result = await loadPublicMenu(createPublicClient(), parsed.data.businessId, parsed.data.slug);
    return result ? res.json(result) : notFound(res);
  } catch (error) { next(error); }
}

// Shared persisted reader: legacy URLs and microsites use exactly these filters.
export async function loadPublicMenu(db, businessId, slug) {
    // ==================================
    // 1. COMPROBAR CARTA PUBLICADA
    // ==================================

    const { data: menu, error: menuError } = await db
      .from("menus")
      .select(
        `
        id,
        business_id,
        name,
        slug,
        description,
        is_published
        `,
      )
      .eq("business_id", businessId)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    checkError(menuError);

    if (!menu) {
      return null;
    }

    // ==================================
    // 2. DATOS PÚBLICOS DEL NEGOCIO
    // ==================================

    const { data: business, error: businessError } = await db
      .from("businesses")
      .select(env.MICROSITES_ENABLED ? "id, name, logo_url, public_slug" : "id, name, logo_url")
      .eq("id", businessId)
      .maybeSingle();

    checkError(businessError);

    if (!business) {
      return null;
    }

    // ==================================
    // 3. DISEÑO PUBLICADO
    // ==================================

    const { data: themeRecord, error: themeError } = await db
      .from("menu_themes")
      .select(
        `
        published_config,
        published_at
        `,
      )
      .eq("menu_id", menu.id)
      .maybeSingle();

    checkError(themeError);

    // Nunca enviar el borrador al cliente.

    if (
      !themeRecord?.published_at ||
      !themeRecord.published_config ||
      Object.keys(themeRecord.published_config).length === 0
    ) {
      return null;
    }

    // ==================================
    // 4. CATEGORÍAS VISIBLES
    // ==================================

    const { data: categories, error: categoryError } = await db
      .from("categories")
      .select(
        `
        id,
        name,
        sort_order
        `,
      )
      .eq("menu_id", menu.id)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });

    checkError(categoryError);

    const categoryIds = categories.map((category) => category.id);

    const languages = env.TRANSLATIONS_ENABLED ? await getPersistedPublicLanguages(db, menu.id) : undefined;

    // Preparar una respuesta vacía
    // si todavía no hay categorías.

    if (!categoryIds.length) {
      return {
        success: true,

        business: {
          id: business.id,
          name: business.name,
          logo_url: business.logo_url,
          ...(business.public_slug ? { public_slug: business.public_slug } : {}),
        },

        menu: {
          id: menu.id,
          name: menu.name,
          slug: menu.slug,
          description: menu.description,
        },

        theme: themeRecord.published_config,

        categories: [],
        ...(languages ? { languages } : {}),
      };
    }

    // ==================================
    // 5. RELACIONES CATEGORÍA-PRODUCTO
    // ==================================

    const { data: relations, error: relationError } = await db
      .from("category_products")
      .select(
        `
        category_id,
        product_id,
        sort_order
        `,
      )
      .in("category_id", categoryIds)
      .order("sort_order", { ascending: true });

    checkError(relationError);

    const productIds = [...new Set(relations.map((relation) => relation.product_id))];

    // ==================================
    // 6. PRODUCTOS DISPONIBLES
    // ==================================

    let products = [];

    if (productIds.length) {
      const { data, error } = await db
        .from("products")
        .select(
          `
          id,
          name,
          description,
          price,
          image_url
          `,
        )
        .eq("business_id", businessId)
        .eq("is_available", true)
        .in("id", productIds);

      checkError(error);

      products = data ?? [];
    }

    const productsById = new Map(products.map((product) => [product.id, product]));

    // ==================================
    // 7. ALÉRGENOS
    // ==================================

    const availableProductIds = products.map((product) => product.id);

    let productAllergens = [];
    let allergens = [];

    if (availableProductIds.length) {
      const [relationsResponse, allergensResponse] = await Promise.all([
        db.from("product_allergens").select("product_id, allergen_id").in("product_id", availableProductIds),

        db.from("allergens").select("id, code, name_es"),
      ]);

      checkError(relationsResponse.error);

      checkError(allergensResponse.error);

      productAllergens = relationsResponse.data ?? [];

      allergens = allergensResponse.data ?? [];
    }

    const allergenNames = new Map(allergens.map((allergen) => [allergen.id, allergen.name_es]));

    const allergensByProduct = new Map();
    const allergenCodes = new Map(allergens.map((allergen) => [allergen.id, allergen.code]));
    const codesByProduct = new Map();

    for (const relation of productAllergens) {
      const name = allergenNames.get(relation.allergen_id);

      if (!name) {
        continue;
      }

      const existing = allergensByProduct.get(relation.product_id) ?? [];

      existing.push(name);

      allergensByProduct.set(relation.product_id, existing);
      const codes = codesByProduct.get(relation.product_id) ?? [];
      codes.push(allergenCodes.get(relation.allergen_id) ?? "");
      codesByProduct.set(relation.product_id, codes);
    }

    // ==================================
    // 8. CONSTRUIR CATEGORÍAS
    // ==================================

    const relationsByCategory = new Map();

    for (const relation of relations) {
      const existing = relationsByCategory.get(relation.category_id) ?? [];

      existing.push(relation);

      relationsByCategory.set(relation.category_id, existing);
    }

    const publicCategories = categories.map((category) => {
      const categoryRelations = relationsByCategory.get(category.id) ?? [];

      const categoryProducts = categoryRelations
        .map((relation) => {
          const product = productsById.get(relation.product_id);

          if (!product) {
            return null;
          }

          return {
            id: product.id,

            name: product.name,

            description: product.description ?? "",

            price: Number(product.price),

            image_url: product.image_url,

            allergens: allergensByProduct.get(product.id) ?? [],
            allergen_codes: codesByProduct.get(product.id) ?? [],
          };
        })
        .filter(Boolean);

      return {
        id: category.id,

        name: category.name,

        products: categoryProducts,
      };
    });

    // ==================================
    // 9. RESPUESTA PÚBLICA
    // ==================================

    return {
      success: true,

      business: {
        id: business.id,
        name: business.name,
        logo_url: business.logo_url,
          ...(business.public_slug ? { public_slug: business.public_slug } : {}),
      },

      menu: {
        id: menu.id,
        name: menu.name,
        slug: menu.slug,
        description: menu.description,
      },

      theme: themeRecord.published_config,

      categories: publicCategories,
      ...(languages ? { languages } : {}),
    };
}
