import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { AppError } from "../errors/app-error.js";
import {
  verifyWebhookSignature,
} from "../security/webhook-signature.js";

export function createWebhookSignatureMiddleware(
  secret: string,
) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    const rawBody = (
      req as Request & {
        rawBody?: Buffer;
      }
    ).rawBody;

    if (!rawBody) {
      return next(
        new AppError(
          "Webhook raw body is unavailable",
          400,
        ),
      );
    }

    const signature =
      req.header("X-Webhook-Signature");

    if (
      !signature ||
      !verifyWebhookSignature(
        rawBody,
        signature,
        secret,
      )
    ) {
      return next(
        new AppError(
          "Invalid webhook signature",
          401,
        ),
      );
    }

    next();
  };
}
