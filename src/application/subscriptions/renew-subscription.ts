import type { TransactionManager } from "../ports/transaction-manager.js";

import { Subscription } from "../../domain/subscription.js";

export interface RenewSubscriptionInput {
  subscriptionId: string;
}

export class RenewSubscription {
  constructor(
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    input: RenewSubscriptionInput,
  ): Promise<Subscription> {
    return this.transactionManager.run(
      async ({
        subscriptionRepository,
        productRepository,
      }) => {
        const subscription =
          await subscriptionRepository.findById(
            input.subscriptionId,
          );

        if (!subscription) {
          throw new Error(
            "Subscription not found",
          );
        }

        if (subscription.status === "SUSPENDED") {
          throw new Error(
            "Suspended subscriptions cannot be renewed",
          );
        }

        const product =
          await productRepository.findById(
            subscription.productId,
          );

        if (!product) {
          throw new Error(
            "Product not found",
          );
        }

        subscription.renew(
          product.durationDays,
          product.gracePeriodDays,
        );

        await subscriptionRepository.save(
          subscription,
        );

        return subscription;
      },
    );
  }
}