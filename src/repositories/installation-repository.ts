import pool from "../config/database.js";
import {
  Installation,
  type InstallationStatus,
} from "../domain/installation.js";
import type {
  AccountNumberAllocation,
} from "../application/ports/account-number-allocator.js";
import type { PoolClient } from "pg";

export class InstallationRepository {
  private readonly client: PoolClient | typeof pool;

  constructor(client?: PoolClient) {
    this.client = client ?? pool;
  }

  async findById(id: string): Promise<Installation | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          pppoe_user_id,
          account_number,
          status,
          created_at
        FROM pppoe_installations
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Installation(
      row.id,
      row.pppoe_user_id,
      row.account_number,
      row.status as InstallationStatus,
      row.created_at,
    );
  }

  async findByIdForUpdate(
    id: string,
  ): Promise<Installation | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          pppoe_user_id,
          account_prefix,
          account_sequence,
          account_number,
          status,
          created_at
        FROM pppoe_installations
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Installation(
      row.id,
      row.pppoe_user_id,
      row.account_number,
      row.status,
      row.created_at,
    );
  }

  async create(
    installation: Installation,
    allocation: AccountNumberAllocation,
  ): Promise<void> {
    await this.client.query(
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
        installation.id,
        installation.pppoeUserId,
        allocation.prefix,
        allocation.sequence,
        allocation.accountNumber,
        installation.status,
        installation.createdAt,
      ],
    );
  }

  async findByAccountNumber(
    accountNumber: string,
  ): Promise<Installation | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          pppoe_user_id,
          account_number,
          status,
          created_at
        FROM pppoe_installations
        WHERE account_number = $1
      `,
      [accountNumber],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Installation(
      row.id,
      row.pppoe_user_id,
      row.account_number,
      row.status as InstallationStatus,
      row.created_at,
    );
  }

  async save(installation: Installation): Promise<void> {
    await this.client.query(
      `
        UPDATE pppoe_installations
        SET
          status = $2
        WHERE id = $1
      `,
      [
        installation.id,
        installation.status,
      ],
    );
  }
}