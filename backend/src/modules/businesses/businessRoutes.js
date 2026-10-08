import multer from "multer";
import { saveBusinessCover } from "./businessCoverController.js";
import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription.js";
import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth.js";

import {
  createBusiness,
  getBusinesses,
  getBusinessById,
  updateBusiness,
  updateBusinessLogo,
  deleteBusinessLogo,
} from "./businessController.js";

const router = Router();

router.use(requireAuth);

router.get("/", getBusinesses);
router.post("/", createBusiness);

router.get("/:id", getBusinessById);
router.patch("/:id", requireActiveSubscription("business"), updateBusiness);

router.patch("/:id/logo", requireActiveSubscription("business"), updateBusinessLogo);
router.delete("/:id/logo", requireActiveSubscription("business"), deleteBusinessLogo);

const coverUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
router.post("/:id/cover", requireActiveSubscription("business"), (req, res, next) => {
  coverUpload.single("image")(req, res, error => error ? res.status(400).json({ message: "Selecciona una imagen de hasta 5 MB." }) : next());
}, saveBusinessCover);
router.delete("/:id/cover", requireActiveSubscription("business"), saveBusinessCover);

export default router;
