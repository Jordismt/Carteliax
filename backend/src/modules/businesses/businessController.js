import { logSafeError } from "../../utils/logSafeError.js";
import { z } from "zod";
import { env } from "../../config/env.js";

import { createUserClient } from "../../infrastructure/database/createUserClient.js";

import { createBusinessSchema, updateBusinessSchema } from "./businessSchemas.js";

const LOGO_BUCKET = "business-logos";
function businessResponse(business) {
  if (env.MICROSITES_ENABLED || !business) return business;
  const { public_slug, public_profile, cover_url, ...legacy } = business;
  return legacy;
}

const businessIdSchema = z.string().uuid();

const logoSchema = z
  .object({
    path: z.string().max(150),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| FUNCIONES AUXILIARES
|--------------------------------------------------------------------------
*/

function getBusinessClient(req) {
  return createUserClient(req.accessToken);
}

function isValidLogoPath(businessId, path) {
  const parsedId = businessIdSchema.safeParse(businessId);

  if (!parsedId.success) {
    return false;
  }

  const parts = path.split("/");

  if (parts.length !== 2) {
    return false;
  }

  const [folder, filename] = parts;

  if (folder !== businessId) {
    return false;
  }

  return /^[0-9a-fA-F-]{36}\.(png|jpg|webp)$/.test(filename);
}

function extractLogoPath(url, supabase) {
  if (!url) {
    return null;
  }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl("__placeholder__");

  const prefix = data.publicUrl.replace("__placeholder__", "");

  if (!url.startsWith(prefix)) {
    return null;
  }

  try {
    return decodeURIComponent(url.slice(prefix.length));
  } catch {
    return null;
  }
}

async function findOwnedBusiness(supabase, businessId, userId) {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/*
|--------------------------------------------------------------------------
| OBTENER TODOS LOS ESTABLECIMIENTOS
|--------------------------------------------------------------------------
*/

export async function getBusinesses(req, res, next) {
  try {
    const supabase = getBusinessClient(req);

    const { data, error } = await supabase
      .from("businesses")
      .select(
        `
        id,
        name,
        slug,
        description,
        logo_url,
        primary_color,
        default_language,
        is_active,
        created_at${env.MICROSITES_ENABLED ? ", public_slug" : ""}
      `,
      )
      .eq("owner_id", req.user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      businesses: data,
      microsites_enabled: env.MICROSITES_ENABLED,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| CREAR ESTABLECIMIENTO
|--------------------------------------------------------------------------
*/

export async function createBusiness(req, res, next) {
  try {
    const parsed = createBusinessSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Los datos del establecimiento no son válidos.",
        errors: z.treeifyError(parsed.error),
      });
    }

    if (!env.MICROSITES_ENABLED && (parsed.data.public_slug || parsed.data.public_profile)) return res.status(503).json({ success: false, message: "La mini web todavía no está activada." });
    const supabase = getBusinessClient(req);

    const { data, error } = await supabase
      .from("businesses")
      .insert({
        ...parsed.data,
        owner_id: req.user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "Esta dirección ya está en uso. Elige otra dirección para tu web.",
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Establecimiento creado correctamente.",
      business: businessResponse(data),
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| OBTENER UN ESTABLECIMIENTO
|--------------------------------------------------------------------------
*/

export async function getBusinessById(req, res, next) {
  try {
    const businessId = req.params.id;

    if (!businessIdSchema.safeParse(businessId).success) {
      return res.status(400).json({
        success: false,
        message: "Identificador de establecimiento no válido.",
      });
    }

    const supabase = getBusinessClient(req);

    const business = await findOwnedBusiness(supabase, businessId, req.user.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    return res.json({
      success: true,
      business: businessResponse(business),
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| ACTUALIZAR ESTABLECIMIENTO
|--------------------------------------------------------------------------
*/

export async function updateBusiness(req, res, next) {
  try {
    const businessId = req.params.id;

    if (!businessIdSchema.safeParse(businessId).success) {
      return res.status(400).json({
        success: false,
        message: "Identificador de establecimiento no válido.",
      });
    }

    const parsed = updateBusinessSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos no válidos.",
        errors: z.treeifyError(parsed.error),
      });
    }

    if (!env.MICROSITES_ENABLED && parsed.data.public_profile) return res.status(503).json({ success: false, message: "La mini web todavía no está activada." });
    const supabase = getBusinessClient(req);

    const { data, error } = await supabase
      .from("businesses")
      .update(parsed.data)
      .eq("id", businessId)
      .eq("owner_id", req.user.id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    return res.json({
      success: true,
      message: "Establecimiento actualizado correctamente.",
      business: businessResponse(data),
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| ACTUALIZAR LOGOTIPO
|--------------------------------------------------------------------------
*/

export async function updateBusinessLogo(req, res, next) {
  try {
    const businessId = req.params.id;

    if (!businessIdSchema.safeParse(businessId).success) {
      return res.status(400).json({
        success: false,
        message: "Identificador de establecimiento no válido.",
      });
    }

    const parsed = logoSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "La ruta de la imagen no es válida.",
      });
    }

    const { path } = parsed.data;

    if (!isValidLogoPath(businessId, path)) {
      return res.status(400).json({
        success: false,
        message: "El archivo no pertenece al establecimiento.",
      });
    }

    const supabase = getBusinessClient(req);

    // Verificar que el usuario es el propietario.
    const business = await findOwnedBusiness(supabase, businessId, req.user.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    // Verificar que el archivo existe.
    const filename = path.split("/")[1];

    const { data: files, error: listError } = await supabase.storage.from(LOGO_BUCKET).list(businessId, {
      search: filename,
      limit: 100,
    });

    if (listError) {
      throw listError;
    }

    const fileExists = files?.some((file) => file.name === filename);

    if (!fileExists) {
      return res.status(400).json({
        success: false,
        message: "La imagen no existe en Supabase Storage.",
      });
    }

    // Generar URL pública.
    const { data: publicUrlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);

    const newLogoUrl = publicUrlData.publicUrl;

    // Guardar la referencia al logotipo anterior.
    const oldLogoPath = extractLogoPath(business.logo_url, supabase);

    // Actualizar la base de datos.
    const { data: updated, error: updateError } = await supabase
      .from("businesses")
      .update({
        logo_url: newLogoUrl,
      })
      .eq("id", businessId)
      .eq("owner_id", req.user.id)
      .select()
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    // Eliminar el logotipo anterior una vez
    // guardado correctamente el nuevo.
    if (oldLogoPath && oldLogoPath !== path && oldLogoPath.startsWith(`${businessId}/`)) {
      const { error: cleanupError } = await supabase.storage.from(LOGO_BUCKET).remove([oldLogoPath]);

      if (cleanupError) {
        logSafeError("BUSINESS_LOGO_CLEANUP", cleanupError);
      }
    }

    return res.json({
      success: true,
      message: "Logotipo actualizado correctamente.",
      business: businessResponse(updated),
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| ELIMINAR LOGOTIPO
|--------------------------------------------------------------------------
*/

export async function deleteBusinessLogo(req, res, next) {
  try {
    const businessId = req.params.id;

    if (!businessIdSchema.safeParse(businessId).success) {
      return res.status(400).json({
        success: false,
        message: "Identificador de establecimiento no válido.",
      });
    }

    const supabase = getBusinessClient(req);

    const business = await findOwnedBusiness(supabase, businessId, req.user.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    if (!business.logo_url) {
      return res.json({
        success: true,
        message: "El establecimiento ya no tiene logotipo.",
        business: businessResponse(business),
      });
    }

    const oldLogoPath = extractLogoPath(business.logo_url, supabase);

    // Primero quitar la referencia de la BD.
    const { data: updated, error: updateError } = await supabase
      .from("businesses")
      .update({
        logo_url: null,
      })
      .eq("id", businessId)
      .eq("owner_id", req.user.id)
      .select()
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    // Después eliminar el archivo de Storage.
    if (oldLogoPath && oldLogoPath.startsWith(`${businessId}/`)) {
      const { error: deleteError } = await supabase.storage.from(LOGO_BUCKET).remove([oldLogoPath]);

      if (deleteError) {
        logSafeError("BUSINESS_LOGO_CLEANUP", deleteError);
      }
    }

    return res.json({
      success: true,
      message: "Logotipo eliminado correctamente.",
      business: businessResponse(updated),
    });
  } catch (error) {
    next(error);
  }
}
