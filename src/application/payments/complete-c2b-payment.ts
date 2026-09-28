import { randomUUID } from "node:crypto";

import { Payment } from "../../domain/payment.js";

import type { TransactionManager } from "../ports/transaction-manager.js";

export interface CompleteC2bPaymentInput {
  accountNumber: string;
  amount: number;
  phone: string;
  providerTransactionId: string;
  receivedAt: Date;
}

export class CompleteC2bPayment {
  constructor(
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    input: CompleteC2bPaymentInput,
  ): Promise<Payment> {
    return this.transactionManager.run(
      async (context) => {
        /*
         * Fast path for ordinary callback retries.
         *
         * This avoids repeating the business lookup when
         * the payment has already been recorded.
         */
        const existingPayment =
          await context.paymentRepository
            .findByProviderTransactionId(
              input.providerTransactionId,
            );

        if (existingPayment) {
          return existingPayment;
        }

        const installation =
          await context.installationRepository
            .findByAccountNumber(
              input.accountNumber,
            );

        if (!installation) {
          throw new Error(
            "Installation not found",
          );
        }

        if (installation.status !== "ACTIVE") {
          throw new Error(
            "Payment can only be applied to an active installation",
          );
        }

        const subscription =
          await context.subscriptionRepository
            .findRenewableByInstallationIdForUpdate(
              installation.id,
            );

        if (!subscription) {
          throw new Error(
            "Renewable subscription not found",
          );
        }

        const products =
          await context.productRepository
            .findByPrice(input.amount);

        if (products.length === 0) {
          throw new Error(
            "No product matches the payment amount",
          );
        }

        if (products.length > 1) {
          throw new Error(
            "Payment amount matches multiple products",
          );
        }

        const product = products[0];

        if (!product) {
          throw new Error(
            "Product not found",
          );
        }

        const payment = new Payment(
          randomUUID(),
          installation.id,
          subscription.id,
          product.id,
          null,

          /*
           * Account number identifies the installation.
           * It is NOT the payment reference.
           */
          `PAY-C2B-${randomUUID()
            .replaceAll("-", "")
            .slice(0, 12)
            .toUpperCase()}`,

          input.amount,
          input.phone,
          "C2B",
          null,
          input.providerTransactionId,
          "COMPLETED",
          input.receivedAt,
          new Date(),
        );

        /*
         * The database UNIQUE constraint on
         * provider_transaction_id serializes competing
         * inserts for the same financial transaction.
         */
        const result =
          await context.paymentRepository
            .createOrGetByProviderTransactionId(
              payment,
            );

        /*
         * Another callback won the race.
         *
         * Its payment is already committed or has just
         * become visible after PostgreSQL resolved the
         * unique constraint conflict.
         *
         * Most importantly: do NOT renew the subscription.
         */
        if (!result.created) {
          return result.payment;
        }

        /*
         * Only the callback that actually created the
         * financial payment is allowed to apply the
         * subscription renewal.
         */
        subscription.renew(
          product.durationDays,
          product.gracePeriodDays,
        );

        await context.subscriptionRepository.save(
          subscription,
        );

        return result.payment;
      },
    );
  }
}