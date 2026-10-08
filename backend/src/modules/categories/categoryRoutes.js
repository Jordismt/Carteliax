import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription.js";
import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth.js";

import {
  getMenuCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "./categoryController.js";

export const menuCategoryRouter = Router();
export const categoryRouter = Router();

menuCategoryRouter.use(requireAuth);
categoryRouter.use(requireAuth);

menuCategoryRouter.get("/:id/categories", requireActiveSubscription("menu"), getMenuCategories);
menuCategoryRouter.post("/:id/categories", requireActiveSubscription("menu"), createCategory);
menuCategoryRouter.patch("/:id/categories/order", requireActiveSubscription("menu"), reorderCategories);

categoryRouter.patch("/:id", requireActiveSubscription("category"), updateCategory);
categoryRouter.delete("/:id", requireActiveSubscription("category"), deleteCategory);
