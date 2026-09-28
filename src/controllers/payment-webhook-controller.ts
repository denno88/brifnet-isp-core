import type { Request, Response } from "express";

import type { Payment } from "../domain/payment.js";
import type { CompletePayment } from "../application/payments/complete-payment.js";
import type {
  CompleteC2bPayment,
} from "../application/payments/complete-c2b-payment.js";
import type { PaymentCompletedEvent } from "../schemas/payment-completed.js";

export class PaymentWebhookController {
  constructor(
    private readonly completePayment: CompletePayment,
    private readonly completeC2bPayment: CompleteC2bPayment,
  ) {}

  async handlePayment(
    req: Request,
    res: Response,
  ): Promise<void> {
    /*
     * The route is responsible for schema validation.
     *
     * By the time we reach this controller, req.body has
     * already been validated and conforms to
     * PaymentCompletedEvent.
     */
    const event = req.body as PaymentCompletedEvent;

    const payment = await this.complete(event);

    res.status(200).json({
      received: true,
      payment: {
        id: payment.id,
        reference: payment.reference,
        status: payment.status,
      },
    });
  }

  private async complete(
    event: PaymentCompletedEvent,
  ): Promise<Payment> {
    const receivedAt = new Date(event.occurred_at);

    if (event.data.channel === "STK") {
      /*
       * STK completion is correlated using the PaymentIntent
       * reference created by our own system.
       */
      return this.completePayment.execute({
        reference: event.data.reference,
        amount: event.data.amount,
        phone: event.data.phone,
        channel: "STK",
        providerReference:
          event.data.provider_reference,
        providerTransactionId:
          event.data.provider_transaction_id,
        receivedAt,
      });
    }

    /*
     * C2B does not use a PaymentIntent.
     *
     * The account number identifies the installation.
     */
    return this.completeC2bPayment.execute({
      accountNumber: event.data.account_number,
      amount: event.data.amount,
      phone: event.data.phone,
      providerTransactionId:
        event.data.provider_transaction_id,
      receivedAt,
    });
  }
}
