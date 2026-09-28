import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type { PoolClient } from "pg";

import pool from "../../../config/database.js";

import {
  Payment,
} from "../../../domain/payment.js";

import {
  PaymentRepository,
} from "../../../repositories/payment-repository.js";

import { CompleteC2bPayment } from "../../../application/payments/complete-c2b-payment.js";

import { PostgresTransactionManager } from "../../../infrastructure/database/postgres-transaction-manager.js";


const ids = {
  userId: "11111111-1111-4111-8111-111111111111",
  planId: "22222222-2222-4222-8222-222222222222",
  productId: "33333333-3333-4333-8333-333333333333",
  installationId: "44444444-4444-4444-8444-444444444444",
  subscriptionId: "55555555-5555-4555-8555-555555555555",
  paymentIdA: "66666666-6666-4666-8666-666666666666",
  paymentIdB: "77777777-7777-4777-8777-777777777777",
};


const providerTransactionId =
  "SAF-C2B-CONCURRENT-001";


let client: PoolClient;


beforeAll(async () => {
  client = await pool.connect();

  /*
   * The test uses fixed IDs so cleanup is deterministic.
   *
   * We delete dependent records first because of the foreign
   * key relationships between payments, subscriptions,
   * installations, products and users.
   */
  await client.query(
    `
      DELETE FROM payments
      WHERE provider_transaction_id = $1
    `,
    [providerTransactionId],
  );

  await client.query(
    `
      DELETE FROM subscriptions
      WHERE id = $1
    `,
    [ids.subscriptionId],
  );

  await client.query(
    `
      DELETE FROM pppoe_installations
      WHERE id = $1
    `,
    [ids.installationId],
  );

  await client.query(
    `
      DELETE FROM products
      WHERE id = $1
    `,
    [ids.productId],
  );

  await client.query(
    `
      DELETE FROM service_plans
      WHERE id = $1
    `,
    [ids.planId],
  );

  await client.query(
    `
      DELETE FROM pppoe_users
      WHERE id = $1
    `,
    [ids.userId],
  );

  /*
   * Seed only the records required by the payment repository.
   */
  await client.query(
    `
      INSERT INTO pppoe_users (
        id,
        name,
        phone,
        status
      )
      VALUES (
        $1,
        'C2B Concurrency Test User',
        '0712345678',
        'ACTIVE'
      )
    `,
    [ids.userId],
  );

  await client.query(
    `
      INSERT INTO service_plans (
        id,
        name,
        download_mbps,
        upload_mbps
      )
      VALUES (
        $1,
        '20 Mbps Test Plan',
        20,
        10
      )
    `,
    [ids.planId],
  );

  await client.query(
    `
      INSERT INTO products (
        id,
        name,
        service_plan_id,
        price,
        duration_days,
        grace_period_days
      )
      VALUES (
        $1,
        '20 Mbps Weekly Test',
        $2,
        1349,
        7,
        1
      )
    `,
    [
      ids.productId,
      ids.planId,
    ],
  );

  await client.query(
    `
      INSERT INTO pppoe_installations (
        id,
        pppoe_user_id,
        account_prefix,
        account_sequence,
        account_number,
        status
      )
      VALUES (
        $1,
        $2,
        'C2B',
        9001,
        'C2B9001',
        'ACTIVE'
      )
    `,
    [
      ids.installationId,
      ids.userId,
    ],
  );

  await client.query(
    `
      INSERT INTO subscriptions (
        id,
        installation_id,
        product_id,
        status,
        current_period_start,
        current_period_end,
        grace_ends_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'ACTIVE',
        '2026-01-01T10:00:00Z',
        '2026-01-08T10:00:00Z',
        '2026-01-09T10:00:00Z'
      )
    `,
    [
      ids.subscriptionId,
      ids.installationId,
      ids.productId,
    ],
  );
});

beforeEach(async () => {
  await client.query(
    `
      DELETE FROM payments
      WHERE provider_transaction_id IN (
        $1,
        $2,
        $3
      )
    `,
    [
      providerTransactionId,
      "SAF-C2B-CONCURRENT-A",
      "SAF-C2B-CONCURRENT-B",
    ],
  );
});

afterAll(async () => {
  /*
   * Clean up in dependency order.
   */

  await client.query(
    `
      DELETE FROM payments
      WHERE provider_transaction_id IN (
        $1,
        $2,
        $3
      )
    `,
    [
      providerTransactionId,
      "SAF-C2B-CONCURRENT-A",
      "SAF-C2B-CONCURRENT-B",
    ],
  );

  await client.query(
    `
      DELETE FROM subscriptions
      WHERE id = $1
    `,
    [ids.subscriptionId],
  );

  await client.query(
    `
      DELETE FROM pppoe_installations
      WHERE id = $1
    `,
    [ids.installationId],
  );

  await client.query(
    `
      DELETE FROM products
      WHERE id = $1
    `,
    [ids.productId],
  );

  await client.query(
    `
      DELETE FROM service_plans
      WHERE id = $1
    `,
    [ids.planId],
  );

  await client.query(
    `
      DELETE FROM pppoe_users
      WHERE id = $1
    `,
    [ids.userId],
  );

  client.release();

  await pool.end();
});


function createPayment(
  id: string,
): Payment {
  return new Payment(
    id,
    ids.installationId,
    ids.subscriptionId,
    ids.productId,
    null,
    `PAY-C2B-${id.slice(0, 8).toUpperCase()}`,
    1349,
    "0712345678",
    "C2B",
    null,
    providerTransactionId,
    "COMPLETED",
    new Date("2026-01-01T10:05:00Z"),
    new Date("2026-01-01T10:05:00Z"),
  );
}


describe(
  "C2B payment repository concurrency",
  () => {
    it(
      "creates exactly one payment when two transactions process the same provider transaction",
      async () => {
        const clientA = await pool.connect();
        const clientB = await pool.connect();

        try {
          const repositoryA =
            new PaymentRepository(clientA);

          const repositoryB =
            new PaymentRepository(clientB);

          const paymentA =
            createPayment(ids.paymentIdA);

          const paymentB =
            createPayment(ids.paymentIdB);

          /*
           * Start transaction A.
           *
           * We intentionally keep this transaction open after
           * inserting the payment so that transaction B has to
           * encounter the real PostgreSQL uniqueness race.
           */
          await clientA.query("BEGIN");

          const resultA =
            await repositoryA
              .createOrGetByProviderTransactionId(
                paymentA,
              );

          expect(resultA.created).toBe(true);

          expect(
            resultA.payment.id,
          ).toBe(ids.paymentIdA);

          /*
           * Start transaction B.
           */
          await clientB.query("BEGIN");

          /*
           * This query will wait for transaction A because both
           * transactions are attempting to use the same unique
           * provider_transaction_id.
           *
           * We deliberately do NOT await it yet.
           */
          const resultBPromise =
            repositoryB
              .createOrGetByProviderTransactionId(
                paymentB,
              );

          /*
           * Give PostgreSQL a moment to reach the unique
           * constraint wait.
           *
           * The important synchronization is the fact that
           * transaction A remains uncommitted.
           */
          await new Promise((resolve) =>
            setTimeout(resolve, 50),
          );

          /*
           * Now commit A.
           *
           * PostgreSQL can resolve B's uniqueness check.
           */
          await clientA.query("COMMIT");

          const resultB =
            await resultBPromise;

          expect(resultB.created).toBe(false);

          /*
           * B must receive A's payment, not its own attempted
           * payment object.
           */
          expect(
            resultB.payment.id,
          ).toBe(ids.paymentIdA);

          expect(
            resultB.payment.providerTransactionId,
          ).toBe(providerTransactionId);

          /*
           * B must never create a second financial record.
           */
          await clientB.query("COMMIT");

          const verification =
            await pool.query(
              `
                SELECT
                  COUNT(*)::integer AS count
                FROM payments
                WHERE provider_transaction_id = $1
              `,
              [providerTransactionId],
            );

          expect(
            verification.rows[0]?.count,
          ).toBe(1);

          const paymentRows =
            await pool.query(
              `
                SELECT
                  id,
                  provider_transaction_id,
                  reference
                FROM payments
                WHERE provider_transaction_id = $1
              `,
              [providerTransactionId],
            );

          expect(
            paymentRows.rows,
          ).toHaveLength(1);

          expect(
            paymentRows.rows[0]?.id,
          ).toBe(ids.paymentIdA);
        } catch (error) {
          /*
           * Make sure both transactions are rolled back if the
           * test itself fails, otherwise a failed concurrency
           * test could leave open transactions holding locks.
           */
          await clientA.query("ROLLBACK").catch(
            () => undefined,
          );

          await clientB.query("ROLLBACK").catch(
            () => undefined,
          );

          throw error;
        } finally {
          clientA.release();
          clientB.release();
        }
      },
    );


    it(
      "returns the existing payment when the provider transaction already exists",
      async () => {
        const payment =
          createPayment(ids.paymentIdA);

        const repository =
          new PaymentRepository(client);

        const firstResult =
          await repository
            .createOrGetByProviderTransactionId(
              payment,
            );

        expect(
          firstResult.created,
        ).toBe(true);

        const duplicatePayment =
          createPayment(ids.paymentIdB);

        const secondResult =
          await repository
            .createOrGetByProviderTransactionId(
              duplicatePayment,
            );

        expect(
          secondResult.created,
        ).toBe(false);

        expect(
          secondResult.payment.id,
        ).toBe(ids.paymentIdA);

        expect(
          secondResult.payment.providerTransactionId,
        ).toBe(providerTransactionId);

        expect(
          secondResult.payment.reference,
        ).toBe(payment.reference);
      },
    );

    it(
      "applies two different concurrent C2B payments as two renewals",
      async () => {
        /*
        * Reset the subscription to a deterministic starting point.
        */
        await client.query(
          `
            UPDATE subscriptions
            SET
              status = 'ACTIVE',
              current_period_start = $2,
              current_period_end = $3,
              grace_ends_at = NULL
            WHERE id = $1
          `,
          [
            ids.subscriptionId,
            new Date("2026-09-01T10:00:00Z"),
            new Date("2026-09-08T10:00:00Z"),
          ],
        );

        /*
        * These are two different legitimate payments.
        *
        * They deliberately have different provider transaction IDs,
        * so this test is about concurrent renewal, not idempotency.
        */
        const paymentA = {
          accountNumber: "C2B9001",
          amount: 1349,
          phone: "0712345678",
          providerTransactionId: "SAF-C2B-CONCURRENT-A",
          receivedAt: new Date("2026-09-08T10:01:00Z"),
        };

        const paymentB = {
          accountNumber: "C2B9001",
          amount: 1349,
          phone: "0712345678",
          providerTransactionId: "SAF-C2B-CONCURRENT-B",
          receivedAt: new Date("2026-09-08T10:02:00Z"),
        };

        const transactionManager =
          new PostgresTransactionManager();

        const completeC2bPayment =
          new CompleteC2bPayment(transactionManager);

        /*
        * Start both payment workflows concurrently.
        *
        * Each execution gets its own PostgreSQL transaction.
        * The subscription row lock must serialize the renewals.
        */
        const [resultA, resultB] = await Promise.all([
          completeC2bPayment.execute(paymentA),
          completeC2bPayment.execute(paymentB),
        ]);

        expect(resultA.providerTransactionId).toBe(
          "SAF-C2B-CONCURRENT-A",
        );

        expect(resultB.providerTransactionId).toBe(
          "SAF-C2B-CONCURRENT-B",
        );

        /*
        * Both legitimate payments must exist.
        */
        const paymentCount = await client.query(
          `
            SELECT COUNT(*)::integer AS count
            FROM payments
            WHERE subscription_id = $1
          `,
          [ids.subscriptionId],
        );

        expect(paymentCount.rows[0]?.count).toBe(2);

        /*
        * The subscription started at September 8.
        *
        * Payment A extends it by 7 days:
        *   September 15
        *
        * Payment B must then see September 15 and extend it again:
        *   September 22
        *
        * Without FOR UPDATE, both transactions could read
        * September 8 and the second save could overwrite the
        * first renewal, leaving September 15.
        */
        const subscriptionResult = await client.query(
          `
            SELECT
              current_period_end,
              status
            FROM subscriptions
            WHERE id = $1
          `,
          [ids.subscriptionId],
        );

        expect(subscriptionResult.rows[0]?.status).toBe(
          "ACTIVE",
        );

        expect(
          subscriptionResult.rows[0]?.current_period_end,
        ).toEqual(
          new Date("2026-09-22T10:00:00Z"),
        );
      },
    );
  },
);
