import pool from "../config/database.js";
import type { PoolClient } from "pg";

import {
  PppoeUser,
  type PppoeUserStatus,
} from "../domain/pppoe-user.js";

import type { PppoeUserRepository as PppoeUserRepositoryPort } from "../application/ports/pppoe-user-repository.js";

export class PppoeUserRepository
  implements PppoeUserRepositoryPort
{
  private readonly client: PoolClient | typeof pool;

  constructor(client?: PoolClient) {
    this.client = client ?? pool;
  }

  async findById(id: string): Promise<PppoeUser | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          name,
          phone,
          status,
          created_at
        FROM pppoe_users
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new PppoeUser(
      row.id,
      row.name,
      row.phone,
      row.status as PppoeUserStatus,
      row.created_at,
    );
  }

  async create(user: PppoeUser): Promise<void> {
    await this.client.query(
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
        user.id,
        user.name,
        user.phone,
        user.status,
        user.createdAt,
      ],
    );
  }

  async save(user: PppoeUser): Promise<void> {
    await this.client.query(
      `
        UPDATE pppoe_users
        SET
          name = $2,
          phone = $3,
          status = $4
        WHERE id = $1
      `,
      [
        user.id,
        user.name,
        user.phone,
        user.status,
      ],
    );
  }
}