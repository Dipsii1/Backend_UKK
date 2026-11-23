import type { Request, Response } from "express";
import { CheckInRepository } from "./check-in.repository.js";
import { CheckInService, checkInRules } from "./check-in.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";

const checkInService = new CheckInService(new CheckInRepository(checkInRules));

export class CheckInController {
  static checkIn = asyncHandler(async (req: Request, res: Response) => {
    const result = await checkInService.checkIn(req.userId!, req.userRole, req.body);
    sendSuccess(res, result, "Check-in berhasil");
  });
}
