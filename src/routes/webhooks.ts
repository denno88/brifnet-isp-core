import express from "express";

import {
  paymentCompletedSchema,
} from "../schemas/payment-completed.js";

import { AppError } from "../errors/app-error.js";

import type {
  PaymentWebhookController,
} from "../controllers/payment-webhook-controller.js";

import {
  createWebhookSignatureMiddleware,
} from "../middleware/verify-webhook-signature.js";

export function createWebhooksRouter(
  paymentWebhookController: PaymentWebhookController,
  webhookSecret: string,
) {
  const router = express.Router();

  router.post(
    "/payment",
    createWebhookSignatureMiddleware(
      webhookSecret,
    ),
    async (req, res, next) => {
      const result =
        paymentCompletedSchema.safeParse(
          req.body,
        );

      if (!result.success) {
        return next(
          new AppError(
            "Invalid payment webhook payload",
            422,
          ),
        );
      }

      /*
       * Only validated data crosses the HTTP boundary
       * into the controller.
       */
      req.body = result.data;

      try {
        await paymentWebhookController.handlePayment(
          req,
          res,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
