import { Router } from "express";

import { getPublicMenu } from "./publicMenuController.js";

const publicMenuRouter = Router();

publicMenuRouter.get("/:businessId/:slug", getPublicMenu);

export default publicMenuRouter;
