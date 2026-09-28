import type {
  Request,
  Response,
} from "express";

import type {
  InitiateStkPayment,
} from "../application/payments/initiate-stk-payment.js";

import type {
  InitiateStkPaymentRequest,
} from "../schemas/initiate-stk-payment.js";

export class StkPaymentController {
  constructor(
    private readonly initiateStkPayment: InitiateStkPayment,
  ) {}

  async handle(
    req: Request,
    res: Response,
  ): Promise<void> {
    const input =
      req.body as InitiateStkPaymentRequest;

    const paymentIntent =
      await this.initiateStkPayment.execute({
        installationId:
          input.installationId,
        phone: input.phone,
      });

    res.status(200).json({
      payment: {
        id: paymentIntent.id,
        reference:
          paymentIntent.reference,
        amount:
          paymentIntent.amount,
        channel:
          paymentIntent.channel,
        status:
          paymentIntent.status,
        expiresAt:
          paymentIntent.expiresAt,
        providerReference:
          paymentIntent.providerReference,
        checkoutRequestId:
          paymentIntent.checkoutRequestId,
      },
    });
  }
}