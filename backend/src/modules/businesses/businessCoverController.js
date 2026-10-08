import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { createUserClient } from "../../infrastructure/database/createUserClient.js";
import { env } from "../../config/env.js";
const bucket = "business-covers";

export async function saveBusinessCover(req, res, next) {
  try {
    if (!env.MICROSITES_ENABLED) return res.status(503).json({ message: "La mini web todavía no está activada." });
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ message: "Establecimiento no válido." });
    const db = createUserClient(req.accessToken);
    const { data: business, error } = await db.from("businesses").select("id, cover_url").eq("id", req.params.id).eq("owner_id", req.user.id).maybeSingle();
    if (error) throw error;
    if (!business) return res.status(404).json({ message: "Establecimiento no encontrado." });
    const storage = db.storage.from(bucket);
    let path = null, newUrl = null;
    if (req.method !== "DELETE") {
      if (!req.file) return res.status(400).json({ message: "Selecciona una fotografía." });
      let buffer;
      try {
        const image = sharp(req.file.buffer, { limitInputPixels: 25000000 });
        const metadata = await image.metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format)) throw Error("format");
        buffer = await image.rotate().resize({ width: 1600, height: 1000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      } catch { return res.status(400).json({ message: "Utiliza una imagen JPEG, PNG o WebP válida." }); }
      path = `${business.id}/${randomUUID()}.webp`;
      const { error: uploadError } = await storage.upload(path, buffer, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
      if (uploadError) throw uploadError;
      newUrl = storage.getPublicUrl(path).data.publicUrl;
    }
    let query = db.from("businesses").update({ cover_url: newUrl }).eq("id", business.id).eq("owner_id", req.user.id);
    query = business.cover_url ? query.eq("cover_url", business.cover_url) : query.is("cover_url", null);
    const { data: updated, error: updateError } = await query.select().maybeSingle();
    if (updateError || !updated) {
      if (path) {
        // A network failure can be ambiguous: never delete a committed cover.
        const { data: current, error: readError } = await db.from("businesses").select("*").eq("id", business.id).eq("owner_id", req.user.id).maybeSingle();
        if (!readError && current?.cover_url === newUrl) return res.json({ success: true, business: current });
        if (!readError && current) await storage.remove([path]);
      }
      if (updateError) throw updateError;
      return res.status(409).json({ message: "La portada cambió. Actualiza e inténtalo de nuevo." });
    }
    const prefix = storage.getPublicUrl("").data.publicUrl.replace(/\/$/, "") + "/";
    if (business.cover_url?.startsWith(prefix)) {
      const oldPath = business.cover_url.slice(prefix.length);
      if (oldPath.startsWith(`${business.id}/`) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(oldPath)) {
        const { error: cleanup } = await storage.remove([oldPath]);
        if (cleanup) console.error("[COVER_CLEANUP]", { code: cleanup.statusCode });
      }
    }
    return res.json({ success: true, business: updated });
  } catch (error) { next(error); }
}
