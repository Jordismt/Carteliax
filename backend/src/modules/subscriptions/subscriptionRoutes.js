import { Router } from "express";

import { requireAuth } from "../../middlewares/requireAuth.js";

import { getSubscription, createCheckout, createPortal, cancelPendingCheckout } from "./subscriptionController.js";

const router = Router();

// Todas estas rutas requieren autenticación.
router.use(requireAuth);

// Consultar la suscripción de un restaurante.
router.get("/:businessId", getSubscription);

// Crear una sesión de Stripe Checkout.
router.post("/checkout", createCheckout);
router.post("/checkout/cancel", cancelPendingCheckout);

// Abrir el portal de facturación de Stripe.
router.post("/portal", createPortal);

export default router;
