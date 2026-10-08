import { z } from "zod";

import { createUserClient } from "../../infrastructure/database/createUserClient.js";

import { DEFAULT_THEME, menuThemeSchema } from "./menuThemeSchemas.js";

const uuidSchema = z.string().uuid();

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

async function findOwnedMenu(supabase, menuId, userId) {
  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("id, business_id")
    .eq("id", menuId)
    .maybeSingle();

  if (menuError) throw menuError;
  if (!menu) return null;

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", menu.business_id)
    .eq("owner_id", userId)
    .maybeSingle();

  if (businessError) throw businessError;

  return business ? menu : null;
}

async function getThemeRecord(supabase, menuId) {
  const { data, error } = await supabase
    .from("menu_themes")
    .select("id, menu_id, draft_config, published_config, " + "updated_at, published_at")
    .eq("menu_id", menuId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function verifyMenu(req, res) {
  const menuId = req.params.id;

  if (!uuidSchema.safeParse(menuId).success) {
    invalidId(res);
    return null;
  }

  const supabase = createUserClient(req.accessToken);

  const menu = await findOwnedMenu(supabase, menuId, req.user.id);

  if (!menu) {
    notFound(res);
    return null;
  }

  return { supabase, menu };
}

// GET /api/menus/:id/theme

export async function getMenuTheme(req, res, next) {
  try {
    const context = await verifyMenu(req, res);

    if (!context) return;

    const { supabase, menu } = context;

    const theme = await getThemeRecord(supabase, menu.id);

    return res.json({
      success: true,
      theme: theme ?? {
        menu_id: menu.id,
        draft_config: DEFAULT_THEME,
        published_config: {},
        updated_at: null,
        published_at: null,
      },
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/menus/:id/theme

export async function saveMenuTheme(req, res, next) {
  try {
    const context = await verifyMenu(req, res);

    if (!context) return;

    const parsed = menuThemeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Configuración visual no válida.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const { supabase, menu } = context;

    // Comprobamos si existe para no modificar
    // accidentalmente la versión publicada.
    const existing = await getThemeRecord(supabase, menu.id);

    let query;

    if (existing) {
      query = supabase
        .from("menu_themes")
        .update({
          draft_config: parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq("menu_id", menu.id);
    } else {
      query = supabase.from("menu_themes").insert({
        menu_id: menu.id,
        draft_config: parsed.data,
      });
    }

    const { data, error } = await query.select().single();

    if (error) throw error;

    return res.json({
      success: true,
      message: "Borrador guardado correctamente.",
      theme: data,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/menus/:id/theme/publish

export async function publishMenuTheme(req, res, next) {
  try {
    const context = await verifyMenu(req, res);

    if (!context) return;

    const { supabase, menu } = context;

    const existing = await getThemeRecord(supabase, menu.id);

    const draft = existing ? existing.draft_config : DEFAULT_THEME;

    const parsed = menuThemeSchema.safeParse(draft);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "El borrador contiene una configuración no válida.",
      });
    }

    const now = new Date().toISOString();

    let query;

    if (existing) {
      query = supabase
        .from("menu_themes")
        .update({
          published_config: parsed.data,
          published_at: now,
          updated_at: now,
        })
        .eq("menu_id", menu.id);
    } else {
      query = supabase.from("menu_themes").insert({
        menu_id: menu.id,
        draft_config: DEFAULT_THEME,
        published_config: parsed.data,
        published_at: now,
      });
    }

    const { data, error } = await query.select().single();

    if (error) throw error;

    return res.json({
      success: true,
      message: "Diseño publicado correctamente.",
      theme: data,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/menus/:id/theme/reset

export async function resetMenuTheme(req, res, next) {
  try {
    const context = await verifyMenu(req, res);

    if (!context) return;

    const { supabase, menu } = context;

    const existing = await getThemeRecord(supabase, menu.id);

    let query;

    if (existing) {
      query = supabase
        .from("menu_themes")
        .update({
          draft_config: DEFAULT_THEME,
          updated_at: new Date().toISOString(),
        })
        .eq("menu_id", menu.id);
    } else {
      query = supabase.from("menu_themes").insert({
        menu_id: menu.id,
        draft_config: DEFAULT_THEME,
      });
    }

    const { data, error } = await query.select().single();

    if (error) throw error;

    return res.json({
      success: true,
      message: "Borrador restablecido.",
      theme: data,
    });
  } catch (error) {
    next(error);
  }
}
