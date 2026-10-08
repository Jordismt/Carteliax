import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription.js";
import { Router } from "express";

import { requireAuth } from "../../middlewares/requireAuth.js";

import { getMenuTheme, saveMenuTheme, publishMenuTheme, resetMenuTheme } from "./menuThemeController.js";

export const menuThemeRouter = Router();

menuThemeRouter.use(requireAuth);

menuThemeRouter.get("/:id/theme", requireActiveSubscription("menu"), getMenuTheme);

menuThemeRouter.put("/:id/theme", requireActiveSubscription("menu"), saveMenuTheme);

menuThemeRouter.post("/:id/theme/publish", requireActiveSubscription("menu"), publishMenuTheme);

menuThemeRouter.post("/:id/theme/reset", requireActiveSubscription("menu"), resetMenuTheme);
