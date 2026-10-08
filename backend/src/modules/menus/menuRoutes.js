import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription.js";
import { Router } from "express";

import { requireAuth } from "../../middlewares/requireAuth.js";

import { getBusinessMenus, createMenu, getMenuById, updateMenu, deleteMenu } from "./menuController.js";

import { duplicateMenu } from "./menuDuplicationController.js";

export const businessMenuRouter = Router();
export const menuRouter = Router();

businessMenuRouter.use(requireAuth);
menuRouter.use(requireAuth);

businessMenuRouter.get("/:id/menus", requireActiveSubscription("business"), getBusinessMenus);
businessMenuRouter.post("/:id/menus", requireActiveSubscription("business"), createMenu);

menuRouter.get("/:id", requireActiveSubscription("menu"), getMenuById);
menuRouter.patch("/:id", requireActiveSubscription("menu"), updateMenu);
menuRouter.delete("/:id", requireActiveSubscription("menu"), deleteMenu);
menuRouter.post("/:id/duplicate", requireActiveSubscription("menu"), duplicateMenu);
