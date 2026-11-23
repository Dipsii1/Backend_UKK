import { Router } from "express";
import { CartController } from "./cart.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { requireNumericParam } from "../../middlewares/security.middleware.js";

const router = Router();
const buyerOnly = [authenticate, authorize("buyer")];

router.get("/", ...buyerOnly, CartController.get);
router.put("/items", ...buyerOnly, CartController.setItem);
router.delete(
  "/items/:ticketTypeId",
  requireNumericParam("ticketTypeId"),
  ...buyerOnly,
  CartController.removeItem,
);
router.post("/checkout", ...buyerOnly, CartController.checkout);

export default router;
