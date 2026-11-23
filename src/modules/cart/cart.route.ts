import { Router } from "express";
import { CartController } from "./cart.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { requireNumericParam } from "../../middlewares/security.middleware.js";
import { cartItemSchema, checkoutSchema } from "./cart.validation.js";

const router = Router();

// Buyer only
router.use(authenticate, authorize("buyer"));

// Cart & ticket reservation
router.get("/", CartController.get);
router.put("/items", validate(cartItemSchema), CartController.setItem);
router.delete("/items/:ticketTypeId", requireNumericParam("ticketTypeId"), CartController.removeItem);

// Checkout
router.post("/checkout", validate(checkoutSchema), CartController.checkout);

export default router;
