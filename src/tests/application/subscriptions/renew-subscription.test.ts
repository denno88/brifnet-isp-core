import { randomUUID } from "node:crypto";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import pool from "../../../config/database.js";

import { RenewSubscription } from "../../../application/subscriptions/renew-subscription.js";

import { PostgresTransactionManager } from "../../../infrastructure/database/postgres-transaction-manager.js";

import type { TransactionManager } from "../../../application/ports/transaction-manager.js";

import { SubscriptionRepository } from "../../../repositories/subscription-repository.js";

import { PaymentIntentRepository } from "../../../repositories/payment-intent-repository.js";

import { PaymentRepository } from "../../../repositories/payment-repository.js";

const millisecondsPerDay =
  24 * 60 * 60 * 1000;

describe("RenewSubscription", () => {
  const transactionManager =
    new PostgresTransactionManager();

  const renewSubscription =
    new RenewSubscription(
      transactionManager,
    );

  const userId = randomUUID();
  const installationId = randomUUID();
  const servicePlanId = randomUUID();
  const productId = randomUUID();
  const subscriptionId = randomUUID();

  const accountNumber = `REN${Date.now()}`;

  afterEach(async () => {
    await pool.query(
      `
        DELETE FROM subscriptions
        WHERE id = $1
      `,
      [subscriptionId],
    );

    await pool.query(
      `
        DELETE FROM pppoe_installations
        WHERE id = $1
      `,
      [installationId],
    );

    await pool.query(
      `
        DELETE FROM products
      WHERE id = $1
      `,
      [productId],
    );

    await pool.query(
      `
        DELETE FROM service_plans
        WHERE id = $1
      `,
      [servicePlanId],
    );

    await pool.query(
      `
        DELETE FROM pppoe_users
        WHERE id = $1
      `,
      [userId],
    );
  });

  async function createFixtures(
    status = "ACTIVE",
  ) {
    const now = new Date();

    await pool.query(
      `
        INSERT INTO pppoe_users (
          id,
          name,
          phone,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        "Renewal Test User",
        "0712345678",
        "ACTIVE",
        now,
      ],
    );

    await pool.query(
      `
        INSERT INTO pppoe_installations (
          id,
          pppoe_user_id,
          account_prefix,
          account_sequence,
          account_number,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        installationId,
        userId,
        "REN",
        999999,
        accountNumber,
        "ACTIVE",
        now,
      ],
    );

    await pool.query(
      `
        INSERT INTO service_plans (
          id,
          name,
          download_mbps,
          upload_mbps,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        servicePlanId,
        "20 Mbps",
        20,
        20,
        now,
      ],
    );

    await pool.query(
      `
        INSERT INTO products (
          id,
          name,
          service_plan_id,
          price,
          duration_days,
          grace_period_days,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        productId,
        "20 Mbps Weekly",
        servicePlanId,
        349,
        7,
        3,
        now,
      ],
    );

    const periodStart = new Date(
      now.getTime() -
        3 * millisecondsPerDay,
    );

    const periodEnd = new Date(
      periodStart.getTime() +
        7 * millisecondsPerDay,
    );

    const graceEndsAt = new Date(
      periodEnd.getTime() +
        3 * millisecondsPerDay,
    );

    await pool.query(
      `
        INSERT INTO subscriptions (
          id,
          installation_id,
          product_id,
          status,
          current_period_start,
          current_period_end,
          grace_ends_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        subscriptionId,
        installationId,
        productId,
        status,
        periodStart,
        periodEnd,
        graceEndsAt,
        now,
      ],
    );

    return {
      periodStart,
      periodEnd,
      graceEndsAt,
    };
  }

  it("extends the subscription from the existing period end", async () => {
    const fixture =
      await createFixtures();

    const originalEnd =
      fixture.periodEnd;

    const subscription =
      await renewSubscription.execute({
        subscriptionId,
      });

    const expectedEnd = new Date(
      originalEnd.getTime() +
        7 * millisecondsPerDay,
    );

    expect(subscription.status).toBe(
      "ACTIVE",
    );

    expect(
      subscription.currentPeriodEnd.getTime(),
    ).toBe(expectedEnd.getTime());

    const expectedGraceEnd =
      new Date(
        expectedEnd.getTime() +
          3 * millisecondsPerDay,
      );

    expect(
      subscription.graceEndsAt?.getTime(),
    ).toBe(
      expectedGraceEnd.getTime(),
    );
  });

  it("does not start the renewed period from the payment time", async () => {
    const fixture =
      await createFixtures();

    const originalEnd =
      fixture.periodEnd;

    const beforeRenewal = Date.now();

    const subscription =
      await renewSubscription.execute({
        subscriptionId,
      });

    const afterRenewal = Date.now();

    const newEnd =
      subscription.currentPeriodEnd.getTime();

    expect(newEnd).toBe(
      originalEnd.getTime() +
        7 * millisecondsPerDay,
    );

    expect(newEnd).toBeGreaterThan(
      afterRenewal,
    );

    expect(
      subscription.currentPeriodStart.getTime(),
    ).toBe(
      fixture.periodStart.getTime(),
    );

    expect(beforeRenewal).toBeLessThan(
      newEnd,
    );
  });

  it("rejects a missing subscription", async () => {
    await expect(
      renewSubscription.execute({
        subscriptionId: randomUUID(),
      }),
    ).rejects.toThrow(
      "Subscription not found",
    );
  });

  it("rejects a suspended subscription", async () => {
    await createFixtures("SUSPENDED");

    await expect(
      renewSubscription.execute({
        subscriptionId,
      }),
    ).rejects.toThrow(
      "Suspended subscriptions cannot be renewed",
    );
  });

  it("rejects when the product no longer exists", async () => {
    await createFixtures();

    const missingProductTransactionManager: TransactionManager = {
      async run(work) {
        const client = await pool.connect();

        try {
          await client.query("BEGIN");

          const context = {
            accountNumberAllocator: {
              async allocate() {
                throw new Error(
                  "Not implemented",
                );
              },
            },

            installationRepository: {
              async create() {
                throw new Error(
                  "Not implemented",
                );
              },

              async findById() {
                throw new Error(
                  "Not implemented",
                );
              },

              findByIdForUpdate: async () => null,

              async findByAccountNumber() {
                throw new Error(
                  "Not implemented",
                );
              },

              async save() {
                throw new Error(
                  "Not implemented",
                );
              },
            },

            pppoeUserRepository: {
              async findById() {
                throw new Error(
                  "Not implemented",
                );
              },

              async create() {
                throw new Error(
                  "Not implemented",
                );
              },

              async save() {
                throw new Error(
                  "Not implemented",
                );
              },
            },

            credentialRepository: {
              async create() {
                throw new Error(
                  "Not implemented",
                );
              },

              async findById() {
                throw new Error(
                  "Not implemented",
                );
              },

              async findActiveByInstallationId() {
                throw new Error(
                  "Not implemented",
                );
              },

              async save() {
                throw new Error(
                  "Not implemented",
                );
              },
            },

            productRepository: {
              async create() {
                throw new Error(
                  "Not implemented",
                );
              },

              async findById() {
                return null;
              },

              async findByPrice() {
                return [];
              },

              async save() {
                throw new Error(
                  "Not implemented",
                );
              },
            },

            subscriptionRepository:
              new SubscriptionRepository(
                client,
              ),

            paymentIntentRepository:
              new PaymentIntentRepository(client),

            paymentRepository:
              new PaymentRepository(client),

            runSavepoint: async <T>(
              work: () => Promise<T>,
            ): Promise<T> => {
              return work();
            },
          };

          return await work(context);
        } finally {
          await client.query("ROLLBACK");
          client.release();
        }
      },
    };

    const useCase =
      new RenewSubscription(
        missingProductTransactionManager,
      );

    await expect(
      useCase.execute({
        subscriptionId,
      }),
    ).rejects.toThrow(
      "Product not found",
    );
  });
});