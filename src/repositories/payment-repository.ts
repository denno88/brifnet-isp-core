import pool from "../config/database.js";

import {
  Payment,
  type PaymentChannel,
  type PaymentStatus,
} from "../domain/payment.js";

import type {
  PaymentRepository as PaymentRepositoryPort,
} from "../application/ports/payment-repository.js";

import type { PoolClient } from "pg";

export class PaymentRepository
  implements PaymentRepositoryPort
{
  private readonly client: PoolClient | typeof pool;

  constructor(client?: PoolClient) {
    this.client = client ?? pool;
  }

  async create(
    payment: Payment,
  ): Promise<void> {
    await this.client.query(
      `
        INSERT INTO payments (
          id,
          installation_id,
          subscription_id,
          product_id,
          payment_intent_id,
          reference,
          amount,
          phone,
          channel,
          provider_reference,
          provider_transaction_id,
          status,
          received_at,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
        )
      `,
      [
        payment.id,
        payment.installationId,
        payment.subscriptionId,
        payment.productId,
        payment.paymentIntentId,
        payment.reference,
        payment.amount,
        payment.phone,
        payment.channel,
        payment.providerReference,
        payment.providerTransactionId,
        payment.status,
        payment.receivedAt,
        payment.createdAt,
      ],
    );
  }

  async findById(
    id: string,
  ): Promise<Payment | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          subscription_id,
          product_id,
          payment_intent_id,
          reference,
          amount,
          phone,
          channel,
          provider_reference,
          provider_transaction_id,
          status,
          received_at,
          created_at
        FROM payments
        WHERE id = $1
      `,
      [id],
    );

    return this.mapFirstRow(result.rows);
  }

  async findByProviderTransactionId(
    providerTransactionId: string,
  ): Promise<Payment | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          subscription_id,
          product_id,
          payment_intent_id,
          reference,
          amount,
          phone,
          channel,
          provider_reference,
          provider_transaction_id,
          status,
          received_at,
          created_at
        FROM payments
        WHERE provider_transaction_id = $1
      `,
      [providerTransactionId],
    );

    return this.mapFirstRow(result.rows);
  }

  async createOrGetByProviderTransactionId(
    payment: Payment,
  ): Promise<{
    payment: Payment;
    created: boolean;
  }> {
    const result = await this.client.query(
      `
        INSERT INTO payments (
          id,
          installation_id,
          subscription_id,
          product_id,
          payment_intent_id,
          reference,
          amount,
          phone,
          channel,
          provider_reference,
          provider_transaction_id,
          status,
          received_at,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14
        )
        ON CONFLICT (provider_transaction_id)
        DO NOTHING
        RETURNING
          id,
          installation_id,
          subscription_id,
          product_id,
          payment_intent_id,
          reference,
          amount,
          phone,
          channel,
          provider_reference,
          provider_transaction_id,
          status,
          received_at,
          created_at
      `,
      [
        payment.id,
        payment.installationId,
        payment.subscriptionId,
        payment.productId,
        payment.paymentIntentId,
        payment.reference,
        payment.amount,
        payment.phone,
        payment.channel,
        payment.providerReference,
        payment.providerTransactionId,
        payment.status,
        payment.receivedAt,
        payment.createdAt,
      ],
    );

    const insertedRow = result.rows[0];

    if (insertedRow) {
      return {
        payment: this.mapRow(insertedRow),
        created: true,
      };
    }

    /*
     * The unique provider transaction already exists.
     *
     * PostgreSQL handles the race here. If another transaction
     * inserted the same provider_transaction_id concurrently,
     * PostgreSQL waits for that transaction to resolve before
     * determining the conflict.
     *
     * We then retrieve the committed payment and tell the
     * application that this callback did not create it.
     */
    const existingResult = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          subscription_id,
          product_id,
          payment_intent_id,
          reference,
          amount,
          phone,
          channel,
          provider_reference,
          provider_transaction_id,
          status,
          received_at,
          created_at
        FROM payments
        WHERE provider_transaction_id = $1
      `,
      [payment.providerTransactionId],
    );

    const existingRow = existingResult.rows[0];

    if (!existingRow) {
      /*
       * This should not normally be reachable.
       *
       * If INSERT reported a provider_transaction_id conflict,
       * the conflicting row must exist once the conflicting
       * transaction has resolved.
       */
      throw new Error(
        "Payment conflict occurred but existing payment was not found",
      );
    }

    return {
      payment: this.mapRow(existingRow),
      created: false,
    };
  }

  async findByReference(
    reference: string,
  ): Promise<Payment | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          subscription_id,
          product_id,
          payment_intent_id,
          reference,
          amount,
          phone,
          channel,
          provider_reference,
          provider_transaction_id,
          status,
          received_at,
          created_at
        FROM payments
        WHERE reference = $1
      `,
      [reference],
    );

    return this.mapFirstRow(result.rows);
  }

  async save(
    payment: Payment,
  ): Promise<void> {
    await this.client.query(
      `
        UPDATE payments
        SET
          status = $2
        WHERE id = $1
      `,
      [
        payment.id,
        payment.status,
      ],
    );
  }

  private mapFirstRow(
    rows: any[],
  ): Payment | null {
    const row = rows[0];

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  private mapRow(
    row: any,
  ): Payment {
    return new Payment(
      row.id,
      row.installation_id,
      row.subscription_id,
      row.product_id,
      row.payment_intent_id,
      row.reference,
      Number(row.amount),
      row.phone,
      row.channel as PaymentChannel,
      row.provider_reference,
      row.provider_transaction_id,
      row.status as PaymentStatus,
      row.received_at,
      row.created_at,
    );
  }
}
