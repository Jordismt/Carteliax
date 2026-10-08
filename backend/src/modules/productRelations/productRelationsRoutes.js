import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription.js";
import { Router } from "express";

import { requireAuth } from "../../middlewares/requireAuth.js";

import {
  getCategoryProducts,
  attachProduct,
  detachProduct,
  getAllergens,
  getProductAllergens,
  updateProductAllergens,
} from "./productRelationsController.js";

export const categoryProductRouter = Router();
export const productAllergenRouter = Router();
export const allergenRouter = Router();

categoryProductRouter.use(requireAuth);
productAllergenRouter.use(requireAuth);
allergenRouter.use(requireAuth);

categoryProductRouter.get("/:id/products", requireActiveSubscription("category"), getCategoryProducts);

categoryProductRouter.post("/:id/products", requireActiveSubscription("category"), attachProduct);

categoryProductRouter.delete("/:id/products/:productId", requireActiveSubscription("category"), detachProduct);

productAllergenRouter.get("/:id/allergens", requireActiveSubscription("product"), getProductAllergens);

productAllergenRouter.put("/:id/allergens", requireActiveSubscription("product"), updateProductAllergens);

allergenRouter.get("/", getAllergens);
