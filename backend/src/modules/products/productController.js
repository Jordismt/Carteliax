import { logSafeError } from "../../utils/logSafeError.js";
import { z } from "zod";

import { randomUUID } from "node:crypto";

import { createUserClient } from "../../infrastructure/database/createUserClient.js";

import { createProductSchema, updateProductSchema } from "./productSchemas.js";

const uuidSchema = z.string().uuid();

const PRODUCT_FIELDS = `
  id,
  business_id,
  name,
  description,
  price,
  image_url,
  is_available,
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
    message: "Producto no encontrado.",
  });
}

async function findOwnedBusiness(db, businessId, userId) {
  const { data, error } = await db
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function findOwnedProduct(db, productId, userId) {
  const { data: product, error } = await db
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("id", productId)
    .maybeSingle();

  if (error) throw error;
  if (!product) return null;

  const business = await findOwnedBusiness(db, product.business_id, userId);

  return business ? product : null;
}

/*
|--------------------------------------------------------------------------
| LISTAR PRODUCTOS DE UN ESTABLECIMIENTO
|--------------------------------------------------------------------------
*/

export async function getBusinessProducts(req, res, next) {
  try {
    const businessId = req.params.id;

    if (!uuidSchema.safeParse(businessId).success) {
      return invalidId(res);
    }

    const db = createUserClient(req.accessToken);

    const business = await findOwnedBusiness(db, businessId, req.user.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    // 1. Obtener todos los productos del establecimiento.
    const { data, error } = await db
      .from("products")
      .select(PRODUCT_FIELDS)
      .eq("business_id", businessId)
      .order("name", { ascending: true });

    if (error) throw error;

    // 2. Obtener sus alérgenos en una sola consulta.
    const productIds = data.map((product) => product.id);

    let allergenRelations = [];

    if (productIds.length > 0) {
      const { data: relations, error: relationsError } = await db
        .from("product_allergens")
        .select("product_id, allergen_id")
        .in("product_id", productIds);

      if (relationsError) throw relationsError;

      allergenRelations = relations ?? [];
    }

    // 3. Agrupar los alérgenos por producto.
    const allergensByProduct = new Map();

    for (const relation of allergenRelations) {
      const current = allergensByProduct.get(relation.product_id) ?? [];

      current.push(relation.allergen_id);

      allergensByProduct.set(relation.product_id, current);
    }

    // 4. Incorporar los alérgenos a cada producto.
    const productsWithAllergens = data.map((product) => ({
      ...product,
      allergenIds: allergensByProduct.get(product.id) ?? [],
    }));

    // 5. Devolver el catálogo completo.
    return res.json({
      success: true,
      products: productsWithAllergens,
    });
  } catch (error) {
    next(error);
  }
}
/*
|--------------------------------------------------------------------------
| CREAR PRODUCTO
|--------------------------------------------------------------------------
*/

export async function createProduct(req, res, next) {
  try {
    const businessId = req.params.id;

    if (!uuidSchema.safeParse(businessId).success) {
      return invalidId(res);
    }

    const parsed = createProductSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos del producto no válidos.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const db = createUserClient(req.accessToken);

    const business = await findOwnedBusiness(db, businessId, req.user.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Establecimiento no encontrado.",
      });
    }

    const { data, error } = await db
      .from("products")
      .insert({
        business_id: businessId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price,
        is_available: parsed.data.is_available ?? true,
      })
      .select(PRODUCT_FIELDS)
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Producto creado correctamente.",
      product: data,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| CONSULTAR PRODUCTO
|--------------------------------------------------------------------------
*/

export async function getProductById(req, res, next) {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const db = createUserClient(req.accessToken);

    const product = await findOwnedProduct(db, req.params.id, req.user.id);

    if (!product) return notFound(res);

    return res.json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| ACTUALIZAR PRODUCTO
|--------------------------------------------------------------------------
*/

export async function updateProduct(req, res, next) {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const parsed = updateProductSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos del producto no válidos.",
        errors: z.treeifyError(parsed.error),
      });
    }

    const db = createUserClient(req.accessToken);

    const product = await findOwnedProduct(db, req.params.id, req.user.id);

    if (!product) return notFound(res);

    const { data, error } = await db
      .from("products")
      .update(parsed.data)
      .eq("id", product.id)
      .eq("business_id", product.business_id)
      .select(PRODUCT_FIELDS)
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(res);

    return res.json({
      success: true,
      message: "Producto actualizado correctamente.",
      product: data,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| ELIMINAR PRODUCTO
|--------------------------------------------------------------------------
*/

export async function deleteProduct(req, res, next) {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) {
      return invalidId(res);
    }

    const db = createUserClient(req.accessToken);

    const product = await findOwnedProduct(db, req.params.id, req.user.id);

    if (!product) return notFound(res);

    // No borramos productos asociados a categorías.
    // Primero deben desvincularse de todas ellas.

    const { count, error: countError } = await db
      .from("category_products")
      .select("category_id", {
        count: "exact",
        head: true,
      })
      .eq("product_id", product.id);

    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      return res.status(409).json({
        success: false,
        message: "El producto está asociado a categorías. Desvincúlalo antes de eliminarlo.",
      });
    }

    const { data, error } = await db
      .from("products")
      .delete()
      .eq("id", product.id)
      .eq("business_id", product.business_id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23503") {
        return res.status(409).json({
          success: false,
          message: "El producto tiene relaciones que impiden eliminarlo.",
        });
      }

      throw error;
    }

    if (!data) return notFound(res);

    return res.json({
      success: true,
      message: "Producto eliminado correctamente.",
    });
  } catch (error) {
    next(error);
  }
}

export async function duplicateProduct(req, res, next) {
  const BUCKET = "product-images";

  let db = null;
  let newProductId = null;
  let newImagePath = null;

  try {
    const productId = req.params.id;

    if (!uuidSchema.safeParse(productId).success) {
      return invalidId(res);
    }

    db = createUserClient(req.accessToken);

    // 1. Comprobar permisos.
    const original = await findOwnedProduct(db, productId, req.user.id);

    if (!original) {
      return notFound(res);
    }

    // 2. Obtener alérgenos.
    const { data: allergens, error: allergensError } = await db
      .from("product_allergens")
      .select("allergen_id")
      .eq("product_id", original.id);

    if (allergensError) throw allergensError;

    // 3. Crear el producto sin compartir la fotografía.
    const { data: copy, error: copyError } = await db
      .from("products")
      .insert({
        business_id: original.business_id,
        name: `${original.name} (copia)`,
        description: original.description,
        price: original.price,
        image_url: null,
        is_available: original.is_available,
      })
      .select(PRODUCT_FIELDS)
      .single();

    if (copyError) throw copyError;

    newProductId = copy.id;

    // 4. Copiar alérgenos.
    if (allergens?.length) {
      const { error } = await db.rpc("set_product_allergens", {
        p_product_id: copy.id,
        p_allergen_ids: allergens.map((item) => item.allergen_id),
      });

      if (error) throw error;
    }

    // 5. Crear una copia física de la fotografía.
    if (original.image_url) {
      const storage = db.storage.from(BUCKET);

      const { data: baseUrlData } = storage.getPublicUrl("");

      const prefix = baseUrlData.publicUrl.replace(/\/$/, "") + "/";

      if (!original.image_url.startsWith(prefix)) {
        throw new Error("La fotografía original tiene una URL no válida.");
      }

      const originalPath = original.image_url.slice(prefix.length);

      const expectedPrefix = `${original.business_id}/${original.id}/`;

      // Comprobar que el archivo pertenece al producto.
      if (
        !originalPath.startsWith(expectedPrefix) ||
        originalPath.includes("..") ||
        originalPath.includes("?") ||
        originalPath.includes("#")
      ) {
        throw new Error("La fotografía original no pertenece al producto.");
      }

      // Descargar fotografía original.
      const { data: imageBlob, error: downloadError } = await storage.download(originalPath);

      if (downloadError) throw downloadError;

      if (!imageBlob) {
        throw new Error("No se pudo descargar la fotografía.");
      }

      // Nueva ruta: carpeta exclusiva del duplicado.
      newImagePath = `${original.business_id}/${copy.id}/` + `${randomUUID()}.webp`;

      const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());

      // Subir la copia independiente.
      const { error: uploadError } = await storage.upload(newImagePath, imageBuffer, {
        contentType: "image/webp",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      // Obtener su nueva URL pública.
      const { data: publicUrlData } = storage.getPublicUrl(newImagePath);

      // Asociarla al producto duplicado.
      const { data: updated, error: imageUpdateError } = await db
        .from("products")
        .update({
          image_url: publicUrlData.publicUrl,
        })
        .eq("id", copy.id)
        .eq("business_id", original.business_id)
        .is("image_url", null)
        .select(PRODUCT_FIELDS)
        .maybeSingle();

      if (imageUpdateError) {
        throw imageUpdateError;
      }

      if (!updated) {
        throw new Error("No se pudo asociar la fotografía al producto duplicado.");
      }

      copy.image_url = updated.image_url;
    }

    // 6. Devolver el nuevo producto.
    return res.status(201).json({
      success: true,
      message: "Producto duplicado correctamente.",
      product: copy,
    });
  } catch (error) {
    // Intentar limpiar la imagen nueva si algo falla.
    if (db && newImagePath) {
      try {
        const { error: cleanupError } = await db.storage.from(BUCKET).remove([newImagePath]);

        if (cleanupError) {
          logSafeError("PRODUCT_CLEANUP", cleanupError);
        }
      } catch (cleanupError) {
        logSafeError("PRODUCT_CLEANUP", cleanupError);
      }
    }

    // Intentar eliminar el producto incompleto.
    if (db && newProductId) {
      try {
        const { error: cleanupError } = await db.from("products").delete().eq("id", newProductId);

        if (cleanupError) {
          logSafeError("PRODUCT_CLEANUP", cleanupError);
        }
      } catch (cleanupError) {
        logSafeError("PRODUCT_CLEANUP", cleanupError);
      }
    }

    next(error);
  }
}
