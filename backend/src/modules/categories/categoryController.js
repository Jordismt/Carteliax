import { z } from "zod";
import { createUserClient } from "../../infrastructure/database/createUserClient.js";

import { createCategorySchema, updateCategorySchema, reorderCategoriesSchema } from "./categorySchemas.js";

const uuid = z.string().uuid();

const FIELDS = `
  id,
  menu_id,
  name,
  description,
  sort_order,
  is_visible,
  created_at
`;

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

async function ownedMenu(db, menuId, userId) {
  const { data: menu, error } = await db
    .from("menus")
    .select("id, business_id, name")
    .eq("id", menuId)
    .maybeSingle();

  if (error) throw error;
  if (!menu) return null;

  const { data: business, error: businessError } = await db
    .from("businesses")
    .select("id")
    .eq("id", menu.business_id)
    .eq("owner_id", userId)
    .maybeSingle();

  if (businessError) throw businessError;

  return business ? menu : null;
}

async function ownedCategory(db, categoryId, userId) {
  const { data: category, error } = await db
    .from("categories")
    .select(FIELDS)
    .eq("id", categoryId)
    .maybeSingle();

  if (error) throw error;
  if (!category) return null;

  const menu = await ownedMenu(db, category.menu_id, userId);

  return menu ? category : null;
}

export async function getMenuCategories(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const db = createUserClient(req.accessToken);
    const menu = await ownedMenu(db, req.params.id, req.user.id);

    if (!menu) return notFound(res);

    const { data, error } = await db
      .from("categories")
      .select(FIELDS)
      .eq("menu_id", menu.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    return res.json({
      success: true,
      categories: data,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const parsed = createCategorySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos de categoría no válidos.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const db = createUserClient(req.accessToken);
    const menu = await ownedMenu(db, req.params.id, req.user.id);

    if (!menu) return notFound(res);

    const { data: last, error: orderError } = await db
      .from("categories")
      .select("sort_order")
      .eq("menu_id", menu.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) throw orderError;

    const { data, error } = await db
      .from("categories")
      .insert({
        menu_id: menu.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        sort_order: (last?.sort_order ?? -1) + 1,
        is_visible: true,
      })
      .select(FIELDS)
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      category: data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const parsed = updateCategorySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos de categoría no válidos.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const db = createUserClient(req.accessToken);

    const category = await ownedCategory(db, req.params.id, req.user.id);

    if (!category) return notFound(res);

    const { data, error } = await db
      .from("categories")
      .update(parsed.data)
      .eq("id", category.id)
      .eq("menu_id", category.menu_id)
      .select(FIELDS)
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(res);

    return res.json({
      success: true,
      category: data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const db = createUserClient(req.accessToken);

    const category = await ownedCategory(db, req.params.id, req.user.id);

    if (!category) return notFound(res);

    // No eliminar categorías con productos asociados.
    const { count, error: countError } = await db
      .from("category_products")
      .select("product_id", {
        count: "exact",
        head: true,
      })
      .eq("category_id", category.id);

    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      return res.status(409).json({
        success: false,
        message: "La categoría contiene productos. Desvincúlalos antes de eliminarla.",
      });
    }

    const { data, error } = await db
      .from("categories")
      .delete()
      .eq("id", category.id)
      .eq("menu_id", category.menu_id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23503") {
        return res.status(409).json({
          success: false,
          message: "La categoría tiene productos asociados.",
        });
      }

      throw error;
    }

    if (!data) return notFound(res);

    return res.json({
      success: true,
      message: "Categoría eliminada.",
    });
  } catch (error) {
    next(error);
  }
}

export async function reorderCategories(req, res, next) {
  try {
    if (!uuid.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const parsed = reorderCategoriesSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Orden de categorías no válido.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const db = createUserClient(req.accessToken);

    const menu = await ownedMenu(db, req.params.id, req.user.id);

    if (!menu) return notFound(res);

    const { data: existing, error: listError } = await db
      .from("categories")
      .select("id")
      .eq("menu_id", menu.id);

    if (listError) throw listError;

    const existingIds = new Set(existing.map((item) => item.id));
    const requestedIds = parsed.data.categoryIds;

    if (existingIds.size !== requestedIds.length || requestedIds.some((id) => !existingIds.has(id))) {
      return res.status(400).json({
        success: false,
        message: "Debes proporcionar todas las categorías de esta carta.",
      });
    }

    // Las actualizaciones individuales no son atómicas.
    // Si una falla, devolvemos error y el frontend
    // recargará el orden guardado.
    for (const [index, id] of requestedIds.entries()) {
      const { data, error } = await db
        .from("categories")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("menu_id", menu.id)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return res.status(409).json({
          success: false,
          message: "No se pudo actualizar el orden. Recarga las categorías.",
        });
      }
    }

    return res.json({
      success: true,
      message: "Categorías ordenadas correctamente.",
    });
  } catch (error) {
    next(error);
  }
}
