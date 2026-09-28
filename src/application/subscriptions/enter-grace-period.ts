import type { TransactionManager } from "../ports/transaction-manager.js";

import type { Subscription } from "../../domain/subscription.js";

export interface EnterGracePeriodInput {
  subscriptionId: string;
}

export class EnterGracePeriod {
  constructor(
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    input: EnterGracePeriodInput,
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

        const product =
          await productRepository.findById(
            subscription.productId,
          );

        if (!product) {
          throw new Error(
            "Product not found",
          );
        }

        subscription.enterGrace(
          new Date(),
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