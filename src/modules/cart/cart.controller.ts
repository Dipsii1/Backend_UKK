import type { Request } from "express";
import { CartService } from "./cart.service.js";
import { cartItemSchema, checkoutSchema } from "./cart.validation.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseSchema } from "../../utils/validation.js";

const cartService = new CartService();

const getUserId = (req: Request) => req.userId!;
const getTicketTypeId = (req: Request) => BigInt(req.params.ticketTypeId as string);

export class CartController {
  static get = asyncHandler(async (req, res) => {
    const data = await cartService.getCart(getUserId(req));
    sendSuccess(res, data, "Keranjang berhasil diambil");
  });

  static setItem = asyncHandler(async (req, res) => {
    const input = parseSchema(cartItemSchema, req.body);
    const data = await cartService.setItem(getUserId(req), input);
    sendSuccess(res, data, "Item keranjang dan reservasi tiket berhasil diperbarui");
  });

  static removeItem = asyncHandler(async (req: Request, res) => {
    await cartService.removeItem(getUserId(req), getTicketTypeId(req));
    res.status(204).send();
  });

  static checkout = asyncHandler(async (req, res) => {
    const input = parseSchema(checkoutSchema, req.body);
    const order = await cartService.checkout(getUserId(req), input);
    sendSuccess(res, order, "Order berhasil dibuat", 201);
  });
}
