import pool from "../config/database.js";

import {
  Product,
} from "../domain/product.js";

import type {
  ProductRepository as ProductRepositoryPort,
} from "../application/ports/product-repository.js";

import type { PoolClient } from "pg";

export class ProductRepository
  implements ProductRepositoryPort
{
  private readonly client: PoolClient | typeof pool;

  constructor(client?: PoolClient) {
    this.client = client ?? pool;
  }

  async findById(
    id: string,
  ): Promise<Product | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          name,
          service_plan_id,
          price,
          duration_days,
          grace_period_days,
          created_at
        FROM products
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Product(
      row.id,
      row.name,
      row.service_plan_id,
      Number(row.price),
      row.duration_days,
      row.grace_period_days,
      row.created_at,
    );
  }

  async create(
    product: Product,
  ): Promise<void> {
    await this.client.query(
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
        product.id,
        product.name,
        product.servicePlanId,
        product.price,
        product.durationDays,
        product.gracePeriodDays,
        product.createdAt,
      ],
    );
  }

  async findByPrice(
    price: number,
  ): Promise<Product[]> {
    const result = await this.client.query(
      `
        SELECT
          id,
          name,
          service_plan_id,
          price,
          duration_days,
          grace_period_days,
          created_at
        FROM products
        WHERE price = $1
        ORDER BY created_at ASC
      `,
      [price],
    );

    return result.rows.map(
      (row) =>
        new Product(
          row.id,
          row.name,
          row.service_plan_id,
          Number(row.price),
          row.duration_days,
          row.grace_period_days,
          row.created_at,
        ),
    );
  }

  async save(
    product: Product,
  ): Promise<void> {
    await this.client.query(
      `
        UPDATE products
        SET
          name = $2,
          service_plan_id = $3,
          price = $4,
          duration_days = $5,
          grace_period_days = $6
        WHERE id = $1
      `,
      [
        product.id,
        product.name,
        product.servicePlanId,
        product.price,
        product.durationDays,
        product.gracePeriodDays,
      ],
    );
  }
}