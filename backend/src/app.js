import { logSafeError } from "./utils/logSafeError.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env.js";
import { createCorsOptions } from "./config/cors.js";
import { getPublicSitemap } from './modules/publicSites/publicSitemapController.js';

// ==========================================
// RUTAS EXISTENTES
// ==========================================

import businessRoutes from "./modules/businesses/businessRoutes.js";

import { businessMenuRouter, menuRouter } from "./modules/menus/menuRoutes.js";

import { menuCategoryRouter, categoryRouter } from "./modules/categories/categoryRoutes.js";

import { businessProductRouter, productRouter } from "./modules/products/productRoutes.js";

import { productImageRouter } from "./modules/productImages/productImageRoutes.js";

import {
  categoryProductRouter,
  productAllergenRouter,
  allergenRouter,
} from "./modules/productRelations/productRelationsRoutes.js";

import { menuThemeRouter } from "./modules/menuThemes/menuThemeRoutes.js";

import publicSiteRouter from "./modules/publicSites/publicSiteRoutes.js";
import publicMenuRouter from "./modules/publicMenus/publicMenuRoutes.js";
import { translationRouter } from "./modules/translations/translationRoutes.js";

// ==========================================
// STRIPE
// ==========================================

import subscriptionRoutes from "./modules/subscriptions/subscriptionRoutes.js";

import { stripeWebhook } from "./modules/subscriptions/stripeWebhookController.js";

// ==========================================
// INICIALIZACIÓN
// ==========================================

const app = express();

// ==========================================
// SEGURIDAD
// ==========================================

app.use(helmet());
app.use((req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next(); });
app.use((req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

app.use(cors(createCorsOptions(env.FRONTEND_URL)));

// ==========================================
// STRIPE WEBHOOK
//
// IMPORTANTE:
// Esta ruta debe registrarse ANTES
// de express.json().
//
// Stripe necesita el cuerpo original
// para verificar la firma del evento.
// ==========================================

app.post(
  "/api/subscriptions/webhook",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),
  stripeWebhook,
);

// ==========================================
// PARSEO JSON
// ==========================================

app.use(
  express.json({
    limit: "1mb",
  }),
);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "Carteliax API",
    status: "online",
  });
});

// ==========================================
// CARTAS PÚBLICAS
// NO REQUIEREN AUTENTICACIÓN
// ==========================================

app.use("/api/public/menus", publicMenuRouter);
app.use("/api/public/sites", publicSiteRouter);
app.get('/api/public/sitemap', getPublicSitemap);

// ==========================================
// ESTABLECIMIENTOS
// ==========================================

app.use("/api/businesses", businessRoutes);

// ==========================================
// CARTAS
// ==========================================

app.use("/api/businesses", businessMenuRouter);

app.use("/api/menus", translationRouter);
app.use("/api/menus", menuRouter);

// ==========================================
// PERSONALIZACIÓN VISUAL
// ==========================================

app.use("/api/menus", menuThemeRouter);

// ==========================================
// CATEGORÍAS
// ==========================================

app.use("/api/menus", menuCategoryRouter);

app.use("/api/categories", categoryRouter);

// ==========================================
// PRODUCTOS
// ==========================================

app.use("/api/businesses", businessProductRouter);

app.use("/api/products", productRouter);

// ==========================================
// RELACIONES
// ==========================================

app.use("/api/categories", categoryProductRouter);

// ==========================================
// ALÉRGENOS DE PRODUCTOS
// ==========================================

app.use("/api/products", productAllergenRouter);

// ==========================================
// CATÁLOGO DE ALÉRGENOS
// ==========================================

app.use("/api/allergens", allergenRouter);

// ==========================================
// IMÁGENES
// ==========================================

app.use("/api/products", productImageRouter);

// ==========================================
// SUSCRIPCIONES
//
// Las rutas privadas utilizan
// requireAuth en subscriptionRoutes.js.
// ==========================================

app.use("/api/subscriptions", subscriptionRoutes);

// ==========================================
// RUTA NO ENCONTRADA
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint no encontrado.",
  });
});

// ==========================================
// GESTIÓN CENTRALIZADA DE ERRORES
// ==========================================

app.use((error, req, res, next) => {
  logSafeError("API_ERROR", error);

  res.status(error?.type === "entity.parse.failed" || error?.type === "entity.too.large" ? 400 : 500).json({
    success: false,
    message: "Ha ocurrido un error interno.",
  });
});

export default app;
