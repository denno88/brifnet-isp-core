import express from "express";

import { AppError } from "../errors/app-error.js";

import {
  initiateStkPaymentSchema,
} from "../schemas/initiate-stk-payment.js";

import type {
  StkPaymentController,
} from "../controllers/stk-payment-controller.js";

export function createPaymentsRouter(
  stkPaymentController: StkPaymentController,
) {
  const router = express.Router();

  router.post(
    "/stk",
    async (req, res, next) => {
      const result =
        initiateStkPaymentSchema.safeParse(
          req.body,
        );

      if (!result.success) {
        return next(
          new AppError(
            "Invalid STK payment request",
            422,
          ),
        );
      }

      req.body = result.data;

      try {
        await stkPaymentController.handle(
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