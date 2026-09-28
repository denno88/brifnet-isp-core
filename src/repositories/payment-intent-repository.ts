import pool from "../config/database.js";

import {
  PaymentIntent,
  type PaymentIntentChannel,
  type PaymentIntentStatus,
} from "../domain/payment-intent.js";

import type {
  PaymentIntentRepository as PaymentIntentRepositoryPort,
} from "../application/ports/payment-intent-repository.js";

import type { PoolClient } from "pg";

export class PaymentIntentRepository
  implements PaymentIntentRepositoryPort
{
  private readonly client: PoolClient | typeof pool;

  constructor(client?: PoolClient) {
    this.client = client ?? pool;
  }

  async create(
    paymentIntent: PaymentIntent,
  ): Promise<void> {
    await this.client.query(
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
          checkout_request_id,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13
        )
      `,
      [
        paymentIntent.id,
        paymentIntent.installationId,
        paymentIntent.subscriptionId,
        paymentIntent.productId,
        paymentIntent.reference,
        paymentIntent.amount,
        paymentIntent.phone,
        paymentIntent.channel,
        paymentIntent.status,
        paymentIntent.expiresAt,
        paymentIntent.providerReference,
        paymentIntent.checkoutRequestId,
        paymentIntent.createdAt,
      ],
    );
  }

  async findById(
    id: string,
  ): Promise<PaymentIntent | null> {
    const result = await this.client.query(
      `
        SELECT
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
          checkout_request_id,
          created_at
        FROM payment_intents
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  async findByReference(
    reference: string,
  ): Promise<PaymentIntent | null> {
    const result = await this.client.query(
      `
        SELECT
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
          checkout_request_id,
          created_at
        FROM payment_intents
        WHERE reference = $1
      `,
      [reference],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }


  async findByReferenceForUpdate(
    reference: string,
  ): Promise<PaymentIntent | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          subscription_id,
          product_id,
          reference,
          amount,
          phone,
          channel,
          status,
          created_at,
          expires_at,
          provider_reference,
          checkout_request_id
        FROM payment_intents
        WHERE reference = $1
        FOR UPDATE
      `,
      [reference],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new PaymentIntent(
      row.id,
      row.installation_id,
      row.subscription_id,
      row.product_id,
      row.reference,
      Number(row.amount),
      row.phone,
      row.channel,
      row.status,
      row.created_at,
      row.expires_at,
      row.provider_reference,
      row.checkout_request_id,
    );
  }

  async findByCheckoutRequestId(
    checkoutRequestId: string,
  ): Promise<PaymentIntent | null> {
    const result = await this.client.query(
      `
        SELECT
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
          checkout_request_id,
          created_at
        FROM payment_intents
        WHERE checkout_request_id = $1
      `,
      [checkoutRequestId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  async findPendingByInstallationId(
    installationId: string,
  ): Promise<PaymentIntent | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          subscription_id,
          product_id,
          reference,
          amount,
          phone,
          channel,
          status,
          created_at,
          expires_at,
          provider_reference,
          checkout_request_id
        FROM payment_intents
        WHERE installation_id = $1
          AND channel = 'STK'
          AND status = 'PENDING'
        LIMIT 1
      `,
      [installationId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  async save(
    paymentIntent: PaymentIntent,
  ): Promise<void> {
    await this.client.query(
      `
        UPDATE payment_intents
        SET
          status = $2,
          provider_reference = $3,
          checkout_request_id = $4
        WHERE id = $1
      `,
      [
        paymentIntent.id,
        paymentIntent.status,
        paymentIntent.providerReference,
        paymentIntent.checkoutRequestId,
      ],
    );
  }

  private mapRow(row: any): PaymentIntent {
    return new PaymentIntent(
      row.id,
      row.installation_id,
      row.subscription_id,
      row.product_id,
      row.reference,
      Number(row.amount),
      row.phone,
      row.channel as PaymentIntentChannel,
      row.status as PaymentIntentStatus,
      row.created_at,
      row.expires_at,
      row.provider_reference,
      row.checkout_request_id,
    );
  }

  async attachProviderDetails(
    paymentIntentId: string,
    providerReference: string,
    checkoutRequestId: string,
  ): Promise<boolean> {
    const result = await this.client.query(
      `
        UPDATE payment_intents
        SET
          provider_reference = $2,
          checkout_request_id = $3
        WHERE id = $1
          AND status = 'PENDING'
      `,
      [
        paymentIntentId,
        providerReference,
        checkoutRequestId,
      ],
    );

    return result.rowCount === 1;
  }

}