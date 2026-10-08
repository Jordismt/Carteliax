import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription.js";
import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../../middlewares/requireAuth.js";

import { uploadProductImage, deleteProductImage } from "./productImageController.js";

export const productImageRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      const error = new Error("Solo se permiten imágenes JPEG, PNG y WebP.");
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  },
});

function receiveImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE" ? "La imagen no puede superar los 5 MB." : "Archivo no válido.",
      });
    }

    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  });
}

productImageRouter.use(requireAuth);

productImageRouter.post("/:id/image", requireActiveSubscription("product"), receiveImage, uploadProductImage);

productImageRouter.delete("/:id/image", requireActiveSubscription("product"), deleteProductImage);
