import { z } from "zod";
import { env } from "../../config/env.js";

import { createUserClient } from "../../infrastructure/database/createUserClient.js";

import { createMenuSchema, updateMenuSchema } from "./menuSchemas.js";
import { ensurePublishedTheme, hasPublishedTheme } from '../menuThemes/menuPublication.js';

const uuidSchema = z.string().uuid();

const MENU_FIELDS = `
  id,
  business_id,
  name,
  slug,
  description,
  is_published,
  sort_order,
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
    message: "Carta no encontrada.",
  });
}

async function findOwnedBusiness(supabase, businessId, userId) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function findOwnedMenu(supabase, menuId, userId) {
  const { data: menu, error } = await supabase
    .from("menus")
    .select(MENU_FIELDS)
    .eq("id", menuId)
    .maybeSingle();

  if (error) throw error;
  if (!menu) return null;

  const business = await findOwnedBusiness(supabase, menu.business_id, userId);

  return business ? menu : null;
}

/*
|--------------------------------------------------------------------------
| LISTAR CARTAS DE UN ESTABLECIMIENTO
|--------------------------------------------------------------------------
*/

export async function getBusinessMenus(req, res, next) {
  try {
    const businessId = req.params.id;

    if (!uuidSchema.safeParse(businessId).success) {
      return invalidId(res);
    }

    const supabase = createUserClient(req.accessToken);

    const business = await findOwnedBusiness(supabase, businessId, req.user.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    const { data, error } = await supabase
      .from("menus")
      .select(`${MENU_FIELDS},menu_themes(published_at,published_config)`)
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    return res.json({
      success: true,
      business,
      menus: data.map(({ menu_themes, ...menu }) => ({ ...menu, public_ready: menu.is_published && hasPublishedTheme(Array.isArray(menu_themes) ? menu_themes[0] : menu_themes) })),
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| CREAR CARTA
|--------------------------------------------------------------------------
*/

export async function createMenu(req, res, next) {
  try {
    const businessId = req.params.id;

    if (!uuidSchema.safeParse(businessId).success) {
      return invalidId(res);
    }

    const parsed = createMenuSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Los datos de la carta no son válidos.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const supabase = createUserClient(req.accessToken);

    const business = await findOwnedBusiness(supabase, businessId, req.user.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    const { data: lastMenu, error: orderError } = await supabase
      .from("menus")
      .select("sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) throw orderError;

    const { data, error } = await supabase
      .from("menus")
      .insert({
        business_id: businessId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        is_published: false,
        sort_order: (lastMenu?.sort_order ?? -1) + 1,
      })
      .select(MENU_FIELDS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "Ya existe una carta con ese identificador en este establecimiento.",
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Carta creada correctamente.",
      menu: data,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| OBTENER CARTA
|--------------------------------------------------------------------------
*/

export async function getMenuById(req, res, next) {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const supabase = createUserClient(req.accessToken);

    const menu = await findOwnedMenu(supabase, req.params.id, req.user.id);

    if (!menu) return notFound(res);

    let publicSlug;
    if (env.MICROSITES_ENABLED) {
      const { data: business, error } = await supabase.from("businesses").select("public_slug").eq("id", menu.business_id).eq("owner_id", req.user.id).maybeSingle();
      if (error) throw error;
      publicSlug = business?.public_slug;
    }
    const { data: theme, error: themeError } = await supabase.from('menu_themes').select('published_at,published_config').eq('menu_id', menu.id).maybeSingle();
    if (themeError) throw themeError;
    return res.json({ success: true, menu: { ...menu, public_ready: menu.is_published && hasPublishedTheme(theme), ...(publicSlug ? { public_slug: publicSlug } : {}) } });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| ACTUALIZAR CARTA
|--------------------------------------------------------------------------
*/

export async function updateMenu(req, res, next) {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const parsed = updateMenuSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Los datos de la carta no son válidos.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const supabase = createUserClient(req.accessToken);

    const menu = await findOwnedMenu(supabase, req.params.id, req.user.id);

    if (!menu) return notFound(res);

    if (parsed.data.is_published === true) await ensurePublishedTheme(supabase, menu.id);

    const { data, error } = await supabase
      .from("menus")
      .update(parsed.data)
      .eq("id", menu.id)
      .eq("business_id", menu.business_id)
      .select(MENU_FIELDS)
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(res);

    return res.json({
      success: true,
      message: "Carta actualizada correctamente.",
      menu: { ...data, ...(parsed.data.is_published === true ? { public_ready: true } : parsed.data.is_published === false ? { public_ready: false } : {}) },
    });
  } catch (error) {
    if (error?.code === 'MENU_PUBLICATION_CONFLICT') return res.status(409).json({ success: false, code: error.code, message: 'El diseño cambió mientras se publicaba. Actualiza la carta y vuelve a intentarlo.' });
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| ELIMINAR CARTA
|--------------------------------------------------------------------------
*/

export async function deleteMenu(req, res, next) {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const supabase = createUserClient(req.accessToken);

    const menu = await findOwnedMenu(supabase, req.params.id, req.user.id);

    if (!menu) return notFound(res);

    // Por seguridad, en esta fase no permitimos
    // borrar cartas que contengan categorías.
    // Evitamos eliminaciones accidentales de productos
    // y relaciones mientras construimos el editor.

    const { count, error: countError } = await supabase
      .from("categories")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("menu_id", menu.id);

    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      return res.status(409).json({
        success: false,
        message: "Esta carta contiene categorías. Elimínalas antes de borrar la carta.",
      });
    }

    const { data: deleted, error } = await supabase
      .from("menus")
      .delete()
      .eq("id", menu.id)
      .eq("business_id", menu.business_id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23503") {
        return res.status(409).json({
          success: false,
          message: "La carta tiene elementos asociados y no se puede eliminar todavía.",
        });
      }

      throw error;
    }

    if (!deleted) return notFound(res);

    return res.json({
      success: true,
      message: "Carta eliminada correctamente.",
    });
  } catch (error) {
    next(error);
  }
}
