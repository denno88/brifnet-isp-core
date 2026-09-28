import { randomUUID } from "node:crypto";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import pool from "../../../config/database.js";

import { EnterGracePeriod } from "../../../application/subscriptions/enter-grace-period.js";

import { PostgresTransactionManager } from "../../../infrastructure/database/postgres-transaction-manager.js";

const millisecondsPerDay =
  24 * 60 * 60 * 1000;

describe("EnterGracePeriod", () => {
  const transactionManager =
    new PostgresTransactionManager();

  const enterGracePeriod =
    new EnterGracePeriod(
      transactionManager,
    );

  const userId = randomUUID();
  const installationId = randomUUID();
  const servicePlanId = randomUUID();
  const productId = randomUUID();
  const subscriptionId = randomUUID();

  const accountNumber = `GRACE${Date.now()}`;

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
    subscriptionStatus = "ACTIVE",
    periodAlreadyEnded = true,
    gracePeriodDays = 3,
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
        "Grace Test User",
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
        "GRACE",
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
        gracePeriodDays,
        now,
      ],
    );

    const periodStart = new Date(
      now.getTime() -
        7 * millisecondsPerDay,
    );

    const periodEnd = periodAlreadyEnded
      ? new Date(
          now.getTime() -
            1 * millisecondsPerDay,
        )
      : new Date(
          now.getTime() +
            1 * millisecondsPerDay,
        );

    const graceEndsAt = periodAlreadyEnded
      ? new Date(
          periodEnd.getTime() +
            gracePeriodDays *
              millisecondsPerDay,
        )
      : null;

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
        subscriptionStatus,
        periodStart,
        periodEnd,
        graceEndsAt,
        now,
      ],
    );

    return {
      periodStart,
      periodEnd,
    };
  }

  it("moves an expired active subscription into grace", async () => {
    const fixture =
      await createFixtures();

    const subscription =
      await enterGracePeriod.execute({
        subscriptionId,
      });

    expect(subscription.status).toBe(
      "GRACE",
    );

    expect(
      subscription.graceEndsAt,
    ).not.toBeNull();

    expect(
      subscription.graceEndsAt?.getTime(),
    ).toBe(
      fixture.periodEnd.getTime() +
        3 * millisecondsPerDay,
    );
  });

  it("does not enter grace while the current period is still active", async () => {
    await createFixtures(
      "ACTIVE",
      false,
    );

    const subscription =
      await enterGracePeriod.execute({
        subscriptionId,
      });

    expect(subscription.status).toBe(
      "ACTIVE",
    );

    expect(
      subscription.graceEndsAt,
    ).toBeNull();
  });

  it("expires immediately when the product has no grace period", async () => {
    await createFixtures(
      "ACTIVE",
      true,
      0,
    );

    const subscription =
      await enterGracePeriod.execute({
        subscriptionId,
      });

    expect(subscription.status).toBe(
      "EXPIRED",
    );

    expect(
      subscription.graceEndsAt,
    ).toBeNull();
  });

  it("does not change a subscription that is already in grace", async () => {
    await createFixtures(
      "GRACE",
      true,
      3,
    );

    const subscription =
      await enterGracePeriod.execute({
        subscriptionId,
      });

    expect(subscription.status).toBe(
      "GRACE",
    );
  });

  it("does not change an expired subscription", async () => {
    await createFixtures(
      "EXPIRED",
      true,
      3,
    );

    const subscription =
      await enterGracePeriod.execute({
        subscriptionId,
      });

    expect(subscription.status).toBe(
      "EXPIRED",
    );
  });

  it("rejects a missing subscription", async () => {
    await expect(
      enterGracePeriod.execute({
        subscriptionId: randomUUID(),
      }),
    ).rejects.toThrow(
      "Subscription not found",
    );
  });
});