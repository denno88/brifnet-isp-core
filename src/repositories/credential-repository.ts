import pool from "../config/database.js";

import {
  Credential,
  type CredentialStatus,
} from "../domain/credential.js";

import type {
  CredentialRepository as CredentialRepositoryPort,
} from "../application/ports/credential-repository.js";

import type { PoolClient } from "pg";

export class CredentialRepository
  implements CredentialRepositoryPort
{
  private readonly client: PoolClient | typeof pool;

  constructor(client?: PoolClient) {
    this.client = client ?? pool;
  }

  async findById(
    id: string,
  ): Promise<Credential | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          username,
          password,
          status,
          created_at
        FROM pppoe_credentials
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Credential(
      row.id,
      row.installation_id,
      row.username,
      row.password,
      row.status as CredentialStatus,
      row.created_at,
    );
  }

  async findActiveByInstallationId(
    installationId: string,
  ): Promise<Credential | null> {
    const result = await this.client.query(
      `
        SELECT
          id,
          installation_id,
          username,
          password,
          status,
          created_at
        FROM pppoe_credentials
        WHERE installation_id = $1
          AND status = 'ACTIVE'
      `,
      [installationId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return new Credential(
      row.id,
      row.installation_id,
      row.username,
      row.password,
      row.status as CredentialStatus,
      row.created_at,
    );
  }

  async create(
    credential: Credential,
  ): Promise<void> {
    await this.client.query(
      `
        INSERT INTO pppoe_credentials (
          id,
          installation_id,
          username,
          password,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        credential.id,
        credential.installationId,
        credential.username,
        credential.password,
        credential.status,
        credential.createdAt,
      ],
    );
  }

  async save(
    credential: Credential,
  ): Promise<void> {
    await this.client.query(
      `
        UPDATE pppoe_credentials
        SET
          password = $2,
          status = $3
        WHERE id = $1
      `,
      [
        credential.id,
        credential.password,
        credential.status,
      ],
    );
  }
}