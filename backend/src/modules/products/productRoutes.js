import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription.js";
import { Router } from "express";

import { requireAuth } from "../../middlewares/requireAuth.js";

import {
  getBusinessProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  duplicateProduct,
} from "./productController.js";

export const businessProductRouter = Router();
export const productRouter = Router();

businessProductRouter.use(requireAuth);
productRouter.use(requireAuth);

businessProductRouter.get("/:id/products", requireActiveSubscription("business"), getBusinessProducts);

businessProductRouter.post("/:id/products", requireActiveSubscription("business"), createProduct);

productRouter.get("/:id", requireActiveSubscription("product"), getProductById);
productRouter.patch("/:id", requireActiveSubscription("product"), updateProduct);
productRouter.delete("/:id", requireActiveSubscription("product"), deleteProduct);
productRouter.post("/:id/duplicate", requireActiveSubscription("product"), duplicateProduct);
