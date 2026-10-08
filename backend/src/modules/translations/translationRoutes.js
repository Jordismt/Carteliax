import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription.js";
import { translationAction, validateTranslationId } from "./translationController.js";

export const translationRouter = Router();
translationRouter.use("/:id/languages", requireAuth, validateTranslationId, requireActiveSubscription("menu"));
translationRouter.get("/:id/languages", translationAction("status"));
translationRouter.patch("/:id/languages/source", translationAction("source"));
translationRouter.post("/:id/languages/:language/translate", translationAction("generate"));
translationRouter.put("/:id/languages/:language/text", translationAction("manual"));
translationRouter.delete("/:id/languages/:language/text", translationAction("delete"));
translationRouter.post("/:id/languages/:language/publish", translationAction("publish"));
translationRouter.patch("/:id/languages/:language", translationAction("visibility"));
