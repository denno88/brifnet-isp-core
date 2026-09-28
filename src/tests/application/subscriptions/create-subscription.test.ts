import { randomUUID } from "node:crypto";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import pool from "../../../config/database.js";

import { CreateSubscription } from "../../../application/subscriptions/create-subscription.js";

import { PostgresTransactionManager } from "../../../infrastructure/database/postgres-transaction-manager.js";

describe("CreateSubscription", () => {
  const transactionManager =
    new PostgresTransactionManager();

  const createSubscription =
    new CreateSubscription(
      transactionManager,
    );

  const userId = randomUUID();
  const installationId = randomUUID();
  const servicePlanId = randomUUID();
  const productId = randomUUID();

  const accountNumber = `TEST${Date.now()}`;

  afterEach(async () => {
    await pool.query(
      `
        DELETE FROM subscriptions
        WHERE installation_id = $1
      `,
      [installationId],
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
    installationStatus: "PENDING" | "ACTIVE" = "ACTIVE",
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
        "Test Customer",
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
        "TEST",
        999999,
        accountNumber,
        installationStatus,
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
  }

  it("creates an active subscription", async () => {
    await createFixtures();

    const subscription =
      await createSubscription.execute({
        installationId,
        productId,
      });

    expect(subscription.installationId).toBe(
      installationId,
    );

    expect(subscription.productId).toBe(
      productId,
    );

    expect(subscription.status).toBe(
      "ACTIVE",
    );

    expect(
      subscription.currentPeriodStart,
    ).toBeInstanceOf(Date);

    expect(
      subscription.currentPeriodEnd,
    ).toBeInstanceOf(Date);

    expect(
      subscription.currentPeriodEnd.getTime(),
    ).toBeGreaterThan(
      subscription.currentPeriodStart.getTime(),
    );

    expect(
      subscription.graceEndsAt,
    ).not.toBeNull();

    const result = await pool.query(
      `
        SELECT
          status,
          installation_id,
          product_id
        FROM subscriptions
        WHERE id = $1
      `,
      [subscription.id],
    );

    expect(result.rows).toHaveLength(1);

    expect(result.rows[0].status).toBe(
      "ACTIVE",
    );

    expect(
      result.rows[0].installation_id,
    ).toBe(installationId);

    expect(
      result.rows[0].product_id,
    ).toBe(productId);
  });

  it("rejects a missing installation", async () => {
    await createFixtures();

    await expect(
      createSubscription.execute({
        installationId: randomUUID(),
        productId,
      }),
    ).rejects.toThrow(
      "Installation not found",
    );
  });

  it("rejects an inactive installation", async () => {
    await createFixtures("PENDING");

    await expect(
      createSubscription.execute({
        installationId,
        productId,
      }),
    ).rejects.toThrow(
      "Subscription can only be created for an active installation",
    );
  });

  it("rejects a missing product", async () => {
    await createFixtures();

    await expect(
      createSubscription.execute({
        installationId,
        productId: randomUUID(),
      }),
    ).rejects.toThrow(
      "Product not found",
    );
  });

  it("rejects an installation with an active subscription", async () => {
    await createFixtures();

    await createSubscription.execute({
      installationId,
      productId,
    });

    await expect(
      createSubscription.execute({
        installationId,
        productId,
      }),
    ).rejects.toThrow(
      "Installation already has an active subscription",
    );
  });
});