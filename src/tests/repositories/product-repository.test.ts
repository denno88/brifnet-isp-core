import { randomUUID } from "node:crypto";

import { describe, expect, it, afterEach } from "vitest";

import pool from "../../config/database.js";
import { ProductRepository } from "../../repositories/product-repository.js";
import { Product } from "../../domain/product.js";

describe("ProductRepository", () => {
  const repository = new ProductRepository();

  const servicePlanId = randomUUID();

  afterEach(async () => {
    await pool.query(
      `
        DELETE FROM products
        WHERE service_plan_id = $1
      `,
      [servicePlanId],
    );

    await pool.query(
      `
        DELETE FROM service_plans
        WHERE id = $1
      `,
      [servicePlanId],
    );
  });

  it("creates and retrieves a product", async () => {
    const now = new Date();

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

    const product = new Product(
      randomUUID(),
      "20 Mbps Weekly",
      servicePlanId,
      349,
      7,
      3,
      now,
    );

    await repository.create(product);

    const retrieved =
      await repository.findById(product.id);

    expect(retrieved).not.toBeNull();

    expect(retrieved?.id).toBe(product.id);
    expect(retrieved?.name).toBe(
      "20 Mbps Weekly",
    );
    expect(retrieved?.servicePlanId).toBe(
      servicePlanId,
    );
    expect(retrieved?.price).toBe(349);
    expect(retrieved?.durationDays).toBe(7);
    expect(retrieved?.gracePeriodDays).toBe(3);
  });

  it("returns null when product does not exist", async () => {
    const result =
      await repository.findById(randomUUID());

    expect(result).toBeNull();
  });

  it("persists product changes", async () => {
    const now = new Date();

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

    const product = new Product(
      randomUUID(),
      "20 Mbps Weekly",
      servicePlanId,
      349,
      7,
      3,
      now,
    );

    await repository.create(product);

    const updatedProduct = new Product(
      product.id,
      "20 Mbps Weekly Updated",
      servicePlanId,
      399,
      7,
      5,
      product.createdAt,
    );

    await repository.save(updatedProduct);

    const retrieved =
      await repository.findById(product.id);

    expect(retrieved?.name).toBe(
      "20 Mbps Weekly Updated",
    );

    expect(retrieved?.price).toBe(399);
    expect(retrieved?.gracePeriodDays).toBe(5);
  });
});