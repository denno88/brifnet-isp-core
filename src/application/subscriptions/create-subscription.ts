import { randomUUID } from "node:crypto";

import { Subscription } from "../../domain/subscription.js";

import type { TransactionManager } from "../ports/transaction-manager.js";

export interface CreateSubscriptionInput {
  installationId: string;
  productId: string;
}

export class CreateSubscription {
  constructor(
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    input: CreateSubscriptionInput,
  ): Promise<Subscription> {
    return this.transactionManager.run(
      async ({
        installationRepository,
        productRepository,
        subscriptionRepository,
      }) => {
        const installation =
          await installationRepository.findById(
            input.installationId,
          );

        if (!installation) {
          throw new Error(
            "Installation not found",
          );
        }

        if (installation.status !== "ACTIVE") {
          throw new Error(
            "Subscription can only be created for an active installation",
          );
        }

        const product =
          await productRepository.findById(
            input.productId,
          );

        if (!product) {
          throw new Error(
            "Product not found",
          );
        }

        const existingSubscription =
          await subscriptionRepository
            .findActiveByInstallationId(
              installation.id,
            );

        if (existingSubscription) {
          throw new Error(
            "Installation already has an active subscription",
          );
        }

        const now = new Date();

        const millisecondsPerDay =
          24 * 60 * 60 * 1000;

        const periodEnd = new Date(
          now.getTime() +
            product.durationDays *
              millisecondsPerDay,
        );

        const graceEndsAt = new Date(
          periodEnd.getTime() +
            product.gracePeriodDays *
              millisecondsPerDay,
        );

        const subscription =
          new Subscription(
            randomUUID(),
            installation.id,
            product.id,
            "ACTIVE",
            now,
            periodEnd,
            graceEndsAt,
            now,
          );

        await subscriptionRepository.create(
          subscription,
        );

        return subscription;
      },
    );
  }
}