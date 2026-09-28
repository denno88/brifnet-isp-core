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
  PaymentIntentRepository,
} from "../../../repositories/payment-intent-repository.js";

import { PostgresTransactionManager } from "../../../infrastructure/database/postgres-transaction-manager.js";

import {
  CompletePayment,
} from "../../../application/payments/complete-payment.js";

import {
  CompleteC2bPayment,
} from "../../../application/payments/complete-c2b-payment.js";

describe(
  "STK payment and payment concurrency",
  () => {
    let clientA: PoolClient;
    let clientB: PoolClient;

    const intentId =
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    const userId =
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    const planId =
      "cccccccc-cccc-cccc-cccc-cccccccccccc";

    const productId =
      "dddddddd-dddd-dddd-dddd-dddddddddddd";

    const installationId =
      "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

    const subscriptionId =
      "ffffffff-ffff-ffff-ffff-ffffffffffff";

    beforeAll(async () => {
      clientA = await pool.connect();
      clientB = await pool.connect();
    });

    beforeEach(async () => {
      /*
       * Clean dependent records first.
       *
       * Payments reference subscriptions and payment intents,
       * so they must be deleted before their parent records.
       */
      await clientA.query(
        `
          DELETE FROM payments
          WHERE subscription_id = $1
        `,
        [subscriptionId],
      );

      await clientA.query(
        `
          DELETE FROM payment_intents
          WHERE installation_id = $1
        `,
        [installationId],
      );

      await clientA.query(
        `
          DELETE FROM subscriptions
          WHERE id = $1
        `,
        [subscriptionId],
      );

      await clientA.query(
        `
          DELETE FROM pppoe_installations
          WHERE id = $1
        `,
        [installationId],
      );

      await clientA.query(
        `
          DELETE FROM products
          WHERE id = $1
        `,
        [productId],
      );

      await clientA.query(
        `
          DELETE FROM service_plans
          WHERE id = $1
        `,
        [planId],
      );

      await clientA.query(
        `
          DELETE FROM pppoe_users
          WHERE id = $1
        `,
        [userId],
      );

      /*
       * Recreate the complete dependency graph for every test.
       */
      await clientA.query(
        `
          INSERT INTO pppoe_users (
            id,
            name,
            phone,
            status
          )
          VALUES (
            $1,
            'Concurrency Test User',
            '0712345678',
            'ACTIVE'
          )
        `,
        [userId],
      );

      await clientA.query(
        `
          INSERT INTO service_plans (
            id,
            name,
            download_mbps,
            upload_mbps
          )
          VALUES (
            $1,
            '20 Mbps',
            20,
            20
          )
        `,
        [planId],
      );

      await clientA.query(
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
            '20 Mbps Weekly',
            $2,
            349,
            7,
            1
          )
        `,
        [productId, planId],
      );

      await clientA.query(
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
            'CON',
            100,
            'CON100',
            'ACTIVE'
          )
        `,
        [installationId, userId],
      );

      await clientA.query(
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
            '2026-09-01T10:00:00Z',
            '2026-09-08T10:00:00Z',
            '2026-09-09T10:00:00Z'
          )
        `,
        [
          subscriptionId,
          installationId,
          productId,
        ],
      );

      /*
       * Only ONE pending STK intent is seeded.
       *
       * This is intentional. The database guarantees:
       *
       *   one installation
       *       ->
       *   maximum one PENDING STK intent
       *
       * We therefore never create two pending STK intents
       * for the same installation.
       */
      await clientA.query(
        `
          INSERT INTO payment_intents (
            id,
            installation_id,
            subscription_id,
            product_id,
            reference,
            amount,
            phone,
            channel,
            status,
            expires_at,
            provider_reference,
            checkout_request_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'PAY-CONCURRENCY',
            349,
            '0712345678',
            'STK',
            'PENDING',
            '2026-09-01T10:15:00Z',
            'provider-concurrency',
            'checkout-concurrency'
          )
        `,
        [
          intentId,
          installationId,
          subscriptionId,
          productId,
        ],
      );
    });

    afterAll(async () => {
      /*
       * Final cleanup.
       *
       * Payments are removed first because they reference
       * subscriptions and payment intents.
       */
      await clientA.query(
        `
          DELETE FROM payments
          WHERE subscription_id = $1
        `,
        [subscriptionId],
      );

      await clientA.query(
        `
          DELETE FROM payment_intents
          WHERE installation_id = $1
        `,
        [installationId],
      );

      await clientA.query(
        `
          DELETE FROM subscriptions
          WHERE id = $1
        `,
        [subscriptionId],
      );

      await clientA.query(
        `
          DELETE FROM pppoe_installations
          WHERE id = $1
        `,
        [installationId],
      );

      await clientA.query(
        `
          DELETE FROM products
          WHERE id = $1
        `,
        [productId],
      );

      await clientA.query(
        `
          DELETE FROM service_plans
          WHERE id = $1
        `,
        [planId],
      );

      await clientA.query(
        `
          DELETE FROM pppoe_users
          WHERE id = $1
        `,
        [userId],
      );

      clientA.release();
      clientB.release();

      await pool.end();
    });

    it(
      "serializes concurrent PaymentIntent locks",
      async () => {
        await clientA.query("BEGIN");
        await clientB.query("BEGIN");

        const repositoryA =
          new PaymentIntentRepository(
            clientA,
          );

        const repositoryB =
          new PaymentIntentRepository(
            clientB,
          );

        /*
         * Transaction A acquires the row lock.
         */
        const intentA =
          await repositoryA.findByReferenceForUpdate(
            "PAY-CONCURRENCY",
          );

        expect(intentA).not.toBeNull();

        /*
         * Transaction B attempts to acquire the same
         * row lock.
         *
         * PostgreSQL should block B until A commits.
         */
        let transactionBFinished = false;

        const transactionB =
          repositoryB
            .findByReferenceForUpdate(
              "PAY-CONCURRENCY",
            )
            .then((intent) => {
              transactionBFinished = true;
              return intent;
            });

        /*
         * Give PostgreSQL enough time to demonstrate
         * that B is waiting for A's lock.
         */
        await new Promise((resolve) =>
          setTimeout(resolve, 100),
        );

        expect(
          transactionBFinished,
        ).toBe(false);

        /*
         * Release transaction A's lock.
         */
        await clientA.query("COMMIT");

        /*
         * B can now acquire the row lock and continue.
         */
        const intentB =
          await transactionB;

        expect(intentB).not.toBeNull();
        expect(intentB?.id).toBe(intentId);

        await clientB.query("COMMIT");
      },
    );

    it(
      "processes concurrent STK callbacks idempotently",
      async () => {
        const transactionManagerA =
          new PostgresTransactionManager();

        const transactionManagerB =
          new PostgresTransactionManager();

        const completePaymentA =
          new CompletePayment(
            transactionManagerA,
          );

        const completePaymentB =
          new CompletePayment(
            transactionManagerB,
          );

        const input = {
          reference:
            "PAY-CONCURRENCY",
          amount: 349,
          phone: "0712345678",
          channel: "STK" as const,
          providerReference:
            "provider-concurrency",
          providerTransactionId:
            "MPESA-CONCURRENT-001",
          receivedAt:
            new Date(
              "2026-09-01T10:05:00Z",
            ),
        };

        /*
         * Two independent application transactions
         * process the same gateway callback concurrently.
         */
        const [
          paymentA,
          paymentB,
        ] = await Promise.all([
          completePaymentA.execute(
            input,
          ),
          completePaymentB.execute(
            input,
          ),
        ]);

        /*
         * Both callers must resolve to the same
         * financial Payment.
         */
        expect(
          paymentA.id,
        ).toBe(paymentB.id);

        expect(
          paymentA.providerTransactionId,
        ).toBe(
          "MPESA-CONCURRENT-001",
        );

        /*
         * Exactly one payment must exist in PostgreSQL.
         */
        const paymentRows =
          await clientA.query(
            `
              SELECT
                id,
                provider_transaction_id,
                status
              FROM payments
              WHERE provider_transaction_id = $1
            `,
            [
              "MPESA-CONCURRENT-001",
            ],
          );

        expect(
          paymentRows.rows,
        ).toHaveLength(1);

        expect(
          paymentRows.rows[0]?.status,
        ).toBe("COMPLETED");

        /*
         * The subscription must only be renewed once.
         *
         * Starting period:
         *
         *   Sep 1 -> Sep 8
         *
         * One renewal:
         *
         *   Sep 8 -> Sep 15
         *
         * Two renewals would incorrectly produce Sep 22.
         */
        const subscriptionResult =
          await clientA.query(
            `
              SELECT
                current_period_end
              FROM subscriptions
              WHERE id = $1
            `,
            [subscriptionId],
          );

        expect(
          subscriptionResult
            .rows[0]
            ?.current_period_end
            .toISOString(),
        ).toBe(
          "2026-09-15T10:00:00.000Z",
        );
      },
    );

    it(
      "serializes concurrent C2B payments for the same subscription",
      async () => {
        /*
         * This test deliberately uses C2B rather than STK.
         *
         * Why?
         *
         * Our business rule allows only one PENDING STK
         * PaymentIntent per installation.
         *
         * Therefore two legitimate simultaneous STK
         * PaymentIntents cannot exist for the same
         * installation.
         *
         * C2B payments do not require PaymentIntents,
         * so two independent payments can legitimately
         * arrive concurrently for the same subscription.
         *
         * This lets us test the important subscription
         * FOR UPDATE concurrency guarantee directly.
         */
        const transactionManagerA =
          new PostgresTransactionManager();

        const transactionManagerB =
          new PostgresTransactionManager();

        const completeC2bPaymentA =
          new CompleteC2bPayment(
            transactionManagerA,
          );

        const completeC2bPaymentB =
          new CompleteC2bPayment(
            transactionManagerB,
          );

        const inputA = {
          accountNumber: "CON100",
          amount: 349,
          phone: "0712345678",
          providerTransactionId:
            "MPESA-C2B-CONCURRENT-A",
          receivedAt:
            new Date(
              "2026-09-08T10:01:00Z",
            ),
        };

        const inputB = {
          accountNumber: "CON100",
          amount: 349,
          phone: "0712345678",
          providerTransactionId:
            "MPESA-C2B-CONCURRENT-B",
          receivedAt:
            new Date(
              "2026-09-08T10:02:00Z",
            ),
        };

        /*
         * Both payments arrive concurrently.
         *
         * Each transaction must lock the same subscription
         * before calculating and saving the next period.
         */
        const [
          paymentA,
          paymentB,
        ] = await Promise.all([
          completeC2bPaymentA.execute(
            inputA,
          ),
          completeC2bPaymentB.execute(
            inputB,
          ),
        ]);

        expect(
          paymentA.providerTransactionId,
        ).toBe(
          "MPESA-C2B-CONCURRENT-A",
        );

        expect(
          paymentB.providerTransactionId,
        ).toBe(
          "MPESA-C2B-CONCURRENT-B",
        );

        /*
         * Both are legitimate financial payments.
         */
        const paymentRows =
          await clientA.query(
            `
              SELECT
                provider_transaction_id,
                status
              FROM payments
              WHERE subscription_id = $1
              ORDER BY provider_transaction_id
            `,
            [subscriptionId],
          );

        expect(
          paymentRows.rows,
        ).toHaveLength(2);

        expect(
          paymentRows.rows.map(
            (row) =>
              row.provider_transaction_id,
          ),
        ).toEqual([
          "MPESA-C2B-CONCURRENT-A",
          "MPESA-C2B-CONCURRENT-B",
        ]);

        expect(
          paymentRows.rows.every(
            (row) =>
              row.status === "COMPLETED",
          ),
        ).toBe(true);

        /*
         * Critical concurrency assertion.
         *
         * Starting period:
         *
         *   Sep 1 -> Sep 8
         *
         * Payment A:
         *
         *   Sep 8 -> Sep 15
         *
         * Payment B must wait for A's subscription
         * row lock, then read the updated Sep 15 value:
         *
         *   Sep 15 -> Sep 22
         *
         * Without FOR UPDATE both transactions could read
         * Sep 8 and both write Sep 15, losing one renewal.
         */
        const subscriptionResult =
          await clientA.query(
            `
              SELECT
                current_period_end,
                status
              FROM subscriptions
              WHERE id = $1
            `,
            [subscriptionId],
          );

        expect(
          subscriptionResult
            .rows[0]?.status,
        ).toBe("ACTIVE");

        expect(
          subscriptionResult
            .rows[0]
            ?.current_period_end
            .toISOString(),
        ).toBe(
          "2026-09-22T10:00:00.000Z",
        );
      },
    );
  },
);
