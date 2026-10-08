import { Router } from "express";
import { getPublicSite } from "./publicSiteController.js";
const router = Router();
router.get("/:slug", getPublicSite);
export default router;
