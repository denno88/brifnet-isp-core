import { randomUUID } from "node:crypto";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import pool from "../../config/database.js";
import { SubscriptionRepository } from "../../repositories/subscription-repository.js";
import { Subscription } from "../../domain/subscription.js";

describe("SubscriptionRepository", () => {
  const repository = new SubscriptionRepository();

  const userId = randomUUID();
  const installationId = randomUUID();
  const servicePlanId = randomUUID();
  const productId = randomUUID();

  const accountNumber = `SUB${Date.now()}`;

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

  async function createFixtures() {
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
        "Subscription Test User",
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
        "SUB",
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
  }

  it("creates and retrieves a subscription", async () => {
    await createFixtures();

    const start = new Date();
    const end = new Date(
      start.getTime() +
        7 * 24 * 60 * 60 * 1000,
    );

    const graceEnd = new Date(
      end.getTime() +
        3 * 24 * 60 * 60 * 1000,
    );

    const subscription = new Subscription(
      randomUUID(),
      installationId,
      productId,
      "ACTIVE",
      start,
      end,
      graceEnd,
      start,
    );

    await repository.create(subscription);

    const retrieved =
      await repository.findById(subscription.id);

    expect(retrieved).not.toBeNull();

    expect(retrieved?.id).toBe(
      subscription.id,
    );

    expect(retrieved?.installationId).toBe(
      installationId,
    );

    expect(retrieved?.productId).toBe(
      productId,
    );

    expect(retrieved?.status).toBe(
      "ACTIVE",
    );

    expect(
      retrieved?.currentPeriodStart.getTime(),
    ).toBe(start.getTime());

    expect(
      retrieved?.currentPeriodEnd.getTime(),
    ).toBe(end.getTime());

    expect(
      retrieved?.graceEndsAt?.getTime(),
    ).toBe(graceEnd.getTime());
  });

  it("returns null when subscription does not exist", async () => {
    const result =
      await repository.findById(
        randomUUID(),
      );

    expect(result).toBeNull();
  });

  it("finds the active subscription for an installation", async () => {
    await createFixtures();

    const start = new Date();

    const subscription = new Subscription(
      randomUUID(),
      installationId,
      productId,
      "ACTIVE",
      start,
      new Date(
        start.getTime() +
          7 * 24 * 60 * 60 * 1000,
      ),
      new Date(
        start.getTime() +
          10 * 24 * 60 * 60 * 1000,
      ),
      start,
    );

    await repository.create(subscription);

    const active =
      await repository.findActiveByInstallationId(
        installationId,
      );

    expect(active).not.toBeNull();

    expect(active?.id).toBe(
      subscription.id,
    );
  });

  it("returns null when installation has no active subscription", async () => {
    await createFixtures();

    const result =
      await repository.findActiveByInstallationId(
        installationId,
      );

    expect(result).toBeNull();
  });

  it("persists subscription state changes", async () => {
    await createFixtures();

    const start = new Date();

    const subscription = new Subscription(
      randomUUID(),
      installationId,
      productId,
      "ACTIVE",
      start,
      new Date(
        start.getTime() +
          7 * 24 * 60 * 60 * 1000,
      ),
      new Date(
        start.getTime() +
          10 * 24 * 60 * 60 * 1000,
      ),
      start,
    );

    await repository.create(subscription);

    subscription.suspend();

    await repository.save(subscription);

    const retrieved =
      await repository.findById(
        subscription.id,
      );

    expect(retrieved?.status).toBe(
      "SUSPENDED",
    );
  });
});