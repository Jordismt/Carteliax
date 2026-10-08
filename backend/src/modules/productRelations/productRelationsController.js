import { z } from "zod";

import { createUserClient } from "../../infrastructure/database/createUserClient.js";

import { attachProductSchema, updateProductAllergensSchema } from "./productRelationsSchemas.js";

const uuid = z.string().uuid();

function invalidId(res) {
  return res.status(400).json({
    success: false,
    message: "Identificador no válido.",
  });
}

function notFound(res) {
  return res.status(404).json({
    success: false,
    message: "Recurso no encontrado.",
  });
}

async function getOwnedCategory(db, categoryId, userId) {
  const { data: category, error } = await db
    .from("categories")
    .select("id, menu_id, name")
    .eq("id", categoryId)
    .maybeSingle();

  if (error) throw error;
  if (!category) return null;

  const { data: menu, error: menuError } = await db
    .from("menus")
    .select("id, business_id")
    .eq("id", category.menu_id)
    .maybeSingle();

  if (menuError) throw menuError;
  if (!menu) return null;

  const { data: business, error: businessError } = await db
    .from("businesses")
    .select("id")
    .eq("id", menu.business_id)
    .eq("owner_id", userId)
    .maybeSingle();

  if (businessError) throw businessError;
  if (!business) return null;

  return {
    ...category,
    business_id: business.id,
  };
}

async function getOwnedProduct(db, productId, userId) {
  const { data: product, error } = await db
    .from("products")
    .select("id, business_id, name")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw error;
  if (!product) return null;

  const { data: business, error: businessError } = await db
    .from("businesses")
    .select("id")
    .eq("id", product.business_id)
    .eq("owner_id", userId)
    .maybeSingle();

  if (businessError) throw businessError;

  return business ? product : null;
}

// LISTAR PRODUCTOS DE UNA CATEGORÍA

export async function getCategoryProducts(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const db = createUserClient(req.accessToken);

    const category = await getOwnedCategory(db, req.params.id, req.user.id);

    if (!category) return notFound(res);

    const { data: relations, error } = await db
      .from("category_products")
      .select("product_id, sort_order")
      .eq("category_id", category.id)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    if (!relations.length) {
      return res.json({
        success: true,
        products: [],
      });
    }

    const ids = relations.map((item) => item.product_id);

    const { data: products, error: productError } = await db
      .from("products")
      .select(
        `
        id,
        business_id,
        name,
        description,
        price,
        image_url,
        is_available,
        created_at
      `,
      )
      .eq("business_id", category.business_id)
      .in("id", ids);

    if (productError) throw productError;

    const byId = new Map(products.map((product) => [product.id, product]));

    const orderedProducts = relations
      .map((relation) => {
        const product = byId.get(relation.product_id);

        return product
          ? {
              ...product,
              sort_order: relation.sort_order,
            }
          : null;
      })
      .filter(Boolean);

    return res.json({
      success: true,
      products: orderedProducts,
    });
  } catch (error) {
    next(error);
  }
}

// ASOCIAR PRODUCTO A CATEGORÍA

export async function attachProduct(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const parsed = attachProductSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos no válidos.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const db = createUserClient(req.accessToken);

    const category = await getOwnedCategory(db, req.params.id, req.user.id);

    if (!category) return notFound(res);

    const product = await getOwnedProduct(db, parsed.data.productId, req.user.id);

    if (!product) return notFound(res);

    if (product.business_id !== category.business_id) {
      return res.status(400).json({
        success: false,
        message: "El producto y la categoría deben pertenecer al mismo establecimiento.",
      });
    }

    const { data: existing, error: existingError } = await db
      .from("category_products")
      .select("product_id")
      .eq("category_id", category.id)
      .eq("product_id", product.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "El producto ya está asociado a esta categoría.",
      });
    }

    const { data: last, error: orderError } = await db
      .from("category_products")
      .select("sort_order")
      .eq("category_id", category.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) throw orderError;

    const { data, error } = await db
      .from("category_products")
      .insert({
        category_id: category.id,
        product_id: product.id,
        sort_order: (last?.sort_order ?? -1) + 1,
      })
      .select("category_id, product_id, sort_order")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "El producto ya está asociado a esta categoría.",
        });
      }

      if (error.code === "23514") {
        return res.status(400).json({
          success: false,
          message: "No se permite asociar productos de otro establecimiento.",
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Producto añadido a la categoría.",
      relation: data,
    });
  } catch (error) {
    next(error);
  }
}

// DESVINCULAR PRODUCTO SIN ELIMINARLO

export async function detachProduct(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success || !uuid.safeParse(req.params.productId).success) {
      return invalidId(res);
    }

    const db = createUserClient(req.accessToken);

    const category = await getOwnedCategory(db, req.params.id, req.user.id);

    if (!category) return notFound(res);

    const product = await getOwnedProduct(db, req.params.productId, req.user.id);

    if (!product || product.business_id !== category.business_id) {
      return notFound(res);
    }

    const { data, error } = await db
      .from("category_products")
      .delete()
      .eq("category_id", category.id)
      .eq("product_id", product.id)
      .select("product_id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(res);

    return res.json({
      success: true,
      message: "Producto desvinculado. Sigue disponible en el catálogo.",
    });
  } catch (error) {
    next(error);
  }
}

// CATÁLOGO GLOBAL DE ALÉRGENOS

export async function getAllergens(req, res, next) {
  try {
    const db = createUserClient(req.accessToken);

    const { data, error } = await db
      .from("allergens")
      .select("id, code, name_es")
      .order("id", { ascending: true });

    if (error) throw error;

    return res.json({
      success: true,
      allergens: data,
    });
  } catch (error) {
    next(error);
  }
}

// CONSULTAR ALÉRGENOS DE UN PRODUCTO

export async function getProductAllergens(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const db = createUserClient(req.accessToken);

    const product = await getOwnedProduct(db, req.params.id, req.user.id);

    if (!product) return notFound(res);

    const { data, error } = await db
      .from("product_allergens")
      .select("allergen_id")
      .eq("product_id", product.id);

    if (error) throw error;

    return res.json({
      success: true,
      allergenIds: data.map((item) => item.allergen_id),
    });
  } catch (error) {
    next(error);
  }
}

// GUARDAR ALÉRGENOS

export async function updateProductAllergens(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const parsed = updateProductAllergensSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Lista de alérgenos no válida.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const db = createUserClient(req.accessToken);

    const product = await getOwnedProduct(db, req.params.id, req.user.id);

    if (!product) return notFound(res);

    const { error } = await db.rpc("set_product_allergens", {
      p_product_id: product.id,
      p_allergen_ids: parsed.data.allergenIds,
    });

    if (error) {
      if (error.code === "22023") {
        return res.status(400).json({
          success: false,
          message: "Uno o varios alérgenos no son válidos.",
        });
      }

      if (error.code === "42501") {
        return notFound(res);
      }

      throw error;
    }

    return res.json({
      success: true,
      message: "Alérgenos actualizados.",
      allergenIds: parsed.data.allergenIds,
    });
  } catch (error) {
    next(error);
  }
}
