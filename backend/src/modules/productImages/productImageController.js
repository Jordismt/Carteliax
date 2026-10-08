import { logSafeError } from "../../utils/logSafeError.js";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { createUserClient } from "../../infrastructure/database/createUserClient.js";

const BUCKET = "product-images";
const uuidSchema = z.string().uuid();

async function getOwnedProduct(db, productId, userId) {
  const { data: product, error } = await db
    .from("products")
    .select("id, business_id, image_url")
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

function getImagePath(db, product, imageUrl) {
  if (!imageUrl) return null;

  const { data } = db.storage.from(BUCKET).getPublicUrl("");

  const prefix = data.publicUrl.replace(/\/$/, "") + "/";

  if (!imageUrl.startsWith(prefix)) {
    return null;
  }

  const path = imageUrl.slice(prefix.length);
  const expectedPrefix = `${product.business_id}/${product.id}/`;

  if (!path.startsWith(expectedPrefix) || path.includes("..") || path.includes("?") || path.includes("#")) {
    return null;
  }

  return path;
}

export async function uploadProductImage(req, res, next) {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) {
      return res.status(400).json({
        success: false,
        message: "Identificador de producto inválido.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Selecciona una imagen.",
      });
    }

    const db = createUserClient(req.accessToken);

    const product = await getOwnedProduct(db, req.params.id, req.user.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado.",
      });
    }

    let imageBuffer;

    try {
      const metadata = await sharp(req.file.buffer, {
        limitInputPixels: 25_000_000,
      }).metadata();

      if (!["jpeg", "png", "webp"].includes(metadata.format)) {
        return res.status(400).json({
          success: false,
          message: "Solo se permiten JPEG, PNG y WebP.",
        });
      }

      imageBuffer = await sharp(req.file.buffer, {
        limitInputPixels: 25_000_000,
      })
        .rotate()
        .resize({
          width: 1400,
          height: 1400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return res.status(400).json({
        success: false,
        message: "El archivo no es una imagen válida.",
      });
    }

    const imagePath = `${product.business_id}/${product.id}/` + `${randomUUID()}.webp`;

    const { error: uploadError } = await db.storage.from(BUCKET).upload(imagePath, imageBuffer, {
      contentType: "image/webp",
      upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = db.storage.from(BUCKET).getPublicUrl(imagePath);

    const imageUrl = publicUrlData.publicUrl;

    // Actualización condicional para evitar que una
    // petición simultánea sobrescriba silenciosamente
    // la fotografía guardada por otra petición.
    let updateQuery = db.from("products").update({ image_url: imageUrl }).eq("id", product.id);

    updateQuery = product.image_url
      ? updateQuery.eq("image_url", product.image_url)
      : updateQuery.is("image_url", null);

    const { data: updated, error: updateError } = await updateQuery.select("id, image_url").maybeSingle();

    if (updateError || !updated) {
      // The write may have committed before its HTTP response was lost.
      // Only remove the upload after a successful read proves it is unused.
      const { data: current, error: readError } = await db.from("products").select("id, image_url").eq("id", product.id).eq("business_id", product.business_id).maybeSingle();
      if (!readError && current?.image_url === imageUrl) return res.json({ success: true, message: "Fotografía guardada correctamente.", product: current });
      if (readError || !current) {
        if (updateError) throw updateError;
        return res.status(503).json({ success: false, message: "No se pudo confirmar el estado de la imagen. Actualiza el producto antes de reintentarlo." });
      }
      const { error: cleanupError } = await db.storage.from(BUCKET).remove([imagePath]);

      if (cleanupError) {
        logSafeError("PRODUCT_IMAGE_CLEANUP", cleanupError);
      }

      if (updateError) throw updateError;

      return res.status(409).json({
        success: false,
        message: "La fotografía cambió durante la operación. Vuelve a intentarlo.",
      });
    }

    // La nueva fotografía ya está guardada.
    // Ahora podemos intentar eliminar la anterior.
    const previousPath = getImagePath(db, product, product.image_url);

    if (previousPath) {
      const { error: removeError } = await db.storage.from(BUCKET).remove([previousPath]);

      if (removeError) {
        logSafeError("PRODUCT_IMAGE_CLEANUP", removeError);
      }
    }

    return res.json({
      success: true,
      message: "Fotografía guardada correctamente.",
      product: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProductImage(req, res, next) {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) {
      return res.status(400).json({
        success: false,
        message: "Identificador de producto inválido.",
      });
    }

    const db = createUserClient(req.accessToken);

    const product = await getOwnedProduct(db, req.params.id, req.user.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado.",
      });
    }

    if (!product.image_url) {
      return res.status(404).json({
        success: false,
        message: "El producto no tiene fotografía.",
      });
    }

    const previousPath = getImagePath(db, product, product.image_url);

    if (!previousPath) {
      return res.status(409).json({
        success: false,
        message: "La URL de la imagen no corresponde al almacenamiento esperado.",
      });
    }

    const { data: updated, error: updateError } = await db
      .from("products")
      .update({ image_url: null })
      .eq("id", product.id)
      .eq("image_url", product.image_url)
      .select("id, image_url")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: "La fotografía cambió. Actualiza el producto e inténtalo nuevamente.",
      });
    }

    const { error: removeError } = await db.storage.from(BUCKET).remove([previousPath]);

    if (removeError) {
      logSafeError("PRODUCT_IMAGE_CLEANUP", removeError);

      return res.status(202).json({
        success: true,
        message: "Fotografía retirada del producto. Queda pendiente limpiar el archivo antiguo.",
        product: updated,
      });
    }

    return res.json({
      success: true,
      message: "Fotografía eliminada.",
      product: updated,
    });
  } catch (error) {
    next(error);
  }
}
