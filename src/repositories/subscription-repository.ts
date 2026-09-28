import pool from "../config/database.js";

import {
  Subscription,
  type SubscriptionStatus,
} from "../domain/subscription.js";

import type {
  SubscriptionRepository as SubscriptionRepositoryPort,
} from "../application/ports/subscription-repository.js";

import type { PoolClient } from "pg";

export class SubscriptionRepository
  implements SubscriptionRepositoryPort
{
  private readonly client: PoolClient | typeof pool;

  constructor(client?: PoolClient) {
    this.client = client ?? pool;
  }

  async create(
    subscription: Subscription,
  ): Promise<void> {
    await this.client.query(
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
        subscription.id,
        subscription.installationId,
        subscription.productId,
        subscription.status,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        subscription.graceEndsAt,
        subscription.createdAt,
      ],
    );
  }

  async findById(
    id: string,
  ): Promise<Subscription | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          product_id,
          status,
          current_period_start,
          current_period_end,
          grace_ends_at,
          created_at
        FROM subscriptions
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Subscription(
      row.id,
      row.installation_id,
      row.product_id,
      row.status as SubscriptionStatus,
      row.current_period_start,
      row.current_period_end,
      row.grace_ends_at,
      row.created_at,
    );
  }

  async findByIdForUpdate(
    id: string,
  ): Promise<Subscription | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          product_id,
          status,
          current_period_start,
          current_period_end,
          grace_ends_at,
          created_at
        FROM subscriptions
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Subscription(
      row.id,
      row.installation_id,
      row.product_id,
      row.status as SubscriptionStatus,
      row.current_period_start,
      row.current_period_end,
      row.grace_ends_at,
      row.created_at,
    );
  }


  async findActiveByInstallationId(
    installationId: string,
  ): Promise<Subscription | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          product_id,
          status,
          current_period_start,
          current_period_end,
          grace_ends_at,
          created_at
        FROM subscriptions
        WHERE installation_id = $1
          AND status = 'ACTIVE'
      `,
      [installationId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Subscription(
      row.id,
      row.installation_id,
      row.product_id,
      row.status as SubscriptionStatus,
      row.current_period_start,
      row.current_period_end,
      row.grace_ends_at,
      row.created_at,
    );
  }

  async findRenewableByInstallationId(
    installationId: string,
  ): Promise<Subscription | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          product_id,
          status,
          current_period_start,
          current_period_end,
          grace_ends_at,
          created_at
        FROM subscriptions
        WHERE installation_id = $1
          AND status IN ('ACTIVE', 'GRACE')
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [installationId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Subscription(
      row.id,
      row.installation_id,
      row.product_id,
      row.status as SubscriptionStatus,
      row.current_period_start,
      row.current_period_end,
      row.grace_ends_at,
      row.created_at,
    );
  }

  async findRenewableByInstallationIdForUpdate(
    installationId: string,
  ): Promise<Subscription | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          product_id,
          status,
          current_period_start,
          current_period_end,
          grace_ends_at,
          created_at
        FROM subscriptions
        WHERE installation_id = $1
          AND status IN ('ACTIVE', 'GRACE')
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [installationId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Subscription( 
      row.id, 
      row.installation_id, 
      row.product_id, 
      row.status as SubscriptionStatus, 
      row.current_period_start, 
      row.current_period_end, 
      row.grace_ends_at, 
      row.created_at, 
    );
  }

  async save(
    subscription: Subscription,
  ): Promise<void> {
    await this.client.query(
      `
        UPDATE subscriptions
        SET
          product_id = $2,
          status = $3,
          current_period_start = $4,
          current_period_end = $5,
          grace_ends_at = $6
        WHERE id = $1
      `,
      [
        subscription.id,
        subscription.productId,
        subscription.status,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        subscription.graceEndsAt,
      ],
    );
  }
}