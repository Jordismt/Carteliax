import { z } from "zod";

import { createUserClient } from "../../infrastructure/database/createUserClient.js";
import { env } from "../../config/env.js";

const uuidSchema = z.string().uuid();

/**
 * POST /api/menus/:id/duplicate
 *
 * Duplica una carta del usuario autenticado.
 *
 * La función SQL duplicate_menu se encarga de:
 * - Crear una nueva carta sin publicar.
 * - Generar un slug único.
 * - Copiar las categorías.
 * - Conservar las asociaciones con los productos.
 * - Copiar el diseño como borrador.
 *
 * Toda la operación se ejecuta en una transacción SQL.
 */
export async function duplicateMenu(req, res, next) {
  try {
    const menuId = req.params.id;

    // 1. Validar identificador.
    if (!uuidSchema.safeParse(menuId).success) {
      return res.status(400).json({
        success: false,
        message: "El identificador de la carta no es válido.",
      });
    }

    // 2. Crear cliente Supabase con el JWT del usuario.
    const db = createUserClient(req.accessToken);

    // 3. Ejecutar la función SQL transaccional.
    // La función comprueba la propiedad de la carta
    // mediante auth.uid().
    const { data: newMenuId, error: duplicateError } = await db.rpc(env.TRANSLATIONS_ENABLED ? "cx_duplicate_menu_with_language" : "duplicate_menu", {
      p_menu_id: menuId,
    });

    if (duplicateError) {
      // Carta inexistente o sin permisos.
      if (duplicateError.code === "42501") {
        return res.status(404).json({
          success: false,
          message: "Carta no encontrada o no tienes permisos para duplicarla.",
        });
      }

      // Posible conflicto con restricciones de la BD.
      if (duplicateError.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "No se pudo generar un identificador único para la copia. Inténtalo de nuevo.",
        });
      }

      throw duplicateError;
    }

    // 4. Comprobar que recibimos el nuevo ID.
    if (!newMenuId || !uuidSchema.safeParse(newMenuId).success) {
      return res.status(500).json({
        success: false,
        message: "La operación no devolvió un identificador de carta válido.",
      });
    }

    // 5. Recuperar la carta recién creada.
    const { data: menu, error: menuError } = await db
      .from("menus")
      .select(
        `
        id,
        business_id,
        name,
        slug,
        description,
        is_published,
        sort_order,
        created_at
      `,
      )
      .eq("id", newMenuId)
      .single();

    if (menuError) throw menuError;

    // 6. Devolver la carta duplicada.
    return res.status(201).json({
      success: true,
      message: "Carta duplicada correctamente.",
      menu,
    });
  } catch (error) {
    next(error);
  }
}
