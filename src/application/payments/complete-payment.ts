import { randomUUID } from "node:crypto";

import { Payment } from "../../domain/payment.js";

import type { TransactionContext } from "../ports/transaction-manager.js";
import type { TransactionManager } from "../ports/transaction-manager.js";

export interface CompletePaymentInput {
  reference: string;
  amount: number;
  phone: string;
  channel: "STK" | "C2B";
  providerReference: string | null;
  providerTransactionId: string;
  receivedAt: Date;
}

export class CompletePayment {
  constructor(
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    input: CompletePaymentInput,
  ): Promise<Payment> {
    return this.transactionManager.run(
      async (context) => {
        if (input.channel !== "STK") {
          throw new Error(
            "C2B payment completion is not implemented yet",
          );
        }

        return this.completeStkPayment(
          input,
          context,
        );
      },
    );
  }

  private async completeStkPayment(
    input: CompletePaymentInput,
    context: TransactionContext,
  ): Promise<Payment> {
    /*
     * Lock the PaymentIntent before checking or changing
     * its state.
     *
     * Concurrent callbacks for the same PaymentIntent
     * must be serialized by PostgreSQL.
     */
    const intent =
      await context.paymentIntentRepository
        .findByReferenceForUpdate(
          input.reference,
        );

    if (!intent) {
      throw new Error(
        "Payment intent not found",
      );
    }

    /*
     * Check for an already-recorded provider transaction
     * immediately after acquiring the PaymentIntent lock.
     *
     * This is important for callback retries.
     *
     * Example:
     *
     * Callback A:
     *   locks intent
     *   creates payment
     *   completes intent
     *   commits
     *
     * Callback B:
     *   waits for the intent lock
     *   obtains the now-completed intent
     *   finds the existing payment
     *   returns it
     *
     * Without this check, Callback B would see a COMPLETED
     * intent and incorrectly fail with "no longer pending".
     */
    const existingPayment =
      await context.paymentRepository
        .findByProviderTransactionId(
          input.providerTransactionId,
        );

    if (existingPayment) {
      return existingPayment;
    }

    if (intent.status !== "PENDING") {
      throw new Error(
        "Payment intent is no longer pending",
      );
    }

    if (intent.channel !== "STK") {
      throw new Error(
        "Payment intent channel mismatch",
      );
    }

    /*
     * The provider reference links the callback to the
     * provider transaction created for this intent.
     */
    if (
      intent.providerReference !== null &&
      input.providerReference !== null &&
      intent.providerReference !==
        input.providerReference
    ) {
      throw new Error(
        "Provider reference mismatch",
      );
    }

    /*
     * Never trust the callback amount blindly.
     * It must match what our system originally requested.
     */
    if (intent.amount !== input.amount) {
      throw new Error(
        "Payment amount mismatch",
      );
    }

    if (intent.phone !== input.phone) {
      throw new Error(
        "Payment phone mismatch",
      );
    }

    /*
     * Lock the subscription before changing its entitlement.
     *
     * This protects against two legitimate payments for the
     * same subscription arriving concurrently.
     */
    const subscription =
      await context.subscriptionRepository
        .findByIdForUpdate(
          intent.subscriptionId,
        );

    if (!subscription) {
      throw new Error(
        "Subscription not found",
      );
    }

    const product =
      await context.productRepository
        .findById(
          intent.productId,
        );

    if (!product) {
      throw new Error(
        "Product not found",
      );
    }

    const payment = new Payment(
      randomUUID(),
      intent.installationId,
      intent.subscriptionId,
      intent.productId,
      intent.id,
      intent.reference,
      input.amount,
      input.phone,
      "STK",
      input.providerReference,
      input.providerTransactionId,
      "COMPLETED",
      input.receivedAt,
      new Date(),
    );

    /*
     * Final database-level idempotency barrier.
     *
     * PostgreSQL enforces uniqueness on
     * provider_transaction_id.
     *
     * This protects us even if the same provider transaction
     * reaches this point through another PaymentIntent or
     * another concurrent execution path.
     */
    const result =
      await context.paymentRepository
        .createOrGetByProviderTransactionId(
          payment,
        );

    if (!result.created) {
      return result.payment;
    }

    /*
     * Only the transaction that successfully created the
     * financial payment is allowed to apply the entitlement.
     */
    subscription.renew(
      product.durationDays,
      product.gracePeriodDays,
    );

    /*
     * Payment, PaymentIntent and Subscription are one
     * business operation.
     *
     * TransactionManager commits all three together or
     * rolls all three back.
     */
    intent.complete();

    await context.paymentIntentRepository.save(
      intent,
    );

    await context.subscriptionRepository.save(
      subscription,
    );

    return result.payment;
  }
}
