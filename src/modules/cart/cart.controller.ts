import type { Request, Response } from "express";
import { CartRepository } from "./cart.repository.js";
import { CartService, cartRules } from "./cart.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";

const cartService = new CartService(new CartRepository(cartRules));

export class CartController {
  static get = asyncHandler(async (req: Request, res: Response) => {
    const cart = await cartService.getCart(req.userId!);
    sendSuccess(res, cart, "Keranjang berhasil diambil");
  });

  static setItem = asyncHandler(async (req: Request, res: Response) => {
    const result = await cartService.setItem(req.userId!, req.body);
    sendSuccess(res, result, "Item keranjang dan reservasi tiket berhasil diperbarui");
  });

  static removeItem = asyncHandler(async (req: Request, res: Response) => {
    const ticketTypeId = BigInt(req.params.ticketTypeId as string);
    await cartService.removeItem(req.userId!, ticketTypeId);
    res.status(204).send();
  });

  static checkout = asyncHandler(async (req: Request, res: Response) => {
    const order = await cartService.checkout(req.userId!, req.body);
    sendSuccess(res, order, "Order berhasil dibuat", 201);
  });
}
