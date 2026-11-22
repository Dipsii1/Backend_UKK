import { Router } from "express";
import { CartController } from "./cart.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requireNumericParam } from "../../middlewares/security.middleware.js";

const router = Router();

router.get("/", authenticate, CartController.get);
router.put("/items", authenticate, CartController.setItem);
router.delete(
  "/items/:ticketTypeId",
  requireNumericParam("ticketTypeId"),
  authenticate,
  CartController.removeItem,
);
router.post("/checkout", authenticate, CartController.checkout);

export default router;
