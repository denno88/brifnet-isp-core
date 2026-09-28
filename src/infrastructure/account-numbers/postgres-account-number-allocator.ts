import type { PoolClient } from "pg";
import type {
  AccountNumberAllocation,
  AccountNumberAllocator,
} from "../../application/ports/account-number-allocator.js";

export class PostgresAccountNumberAllocator
  implements AccountNumberAllocator
{
  constructor(
    private readonly client: PoolClient,
  ) {}

  async allocate(
    prefix: string,
  ): Promise<AccountNumberAllocation> {
    const normalizedPrefix = prefix.trim().toUpperCase();

    if (!normalizedPrefix) {
      throw new Error("Account prefix is required");
    }

    await this.client.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtext($1)
        )
      `,
      [normalizedPrefix],
    );

    const result = await this.client.query(
      `
        SELECT COALESCE(
          MAX(account_sequence),
          99
        ) + 1 AS next_sequence
        FROM pppoe_installations
        WHERE account_prefix = $1
      `,
      [normalizedPrefix],
    );

    const nextSequence = Number(
      result.rows[0]?.next_sequence,
    );

    if (!Number.isInteger(nextSequence)) {
      throw new Error(
        "Failed to allocate account number",
      );
    }

    return {
      prefix: normalizedPrefix,
      sequence: nextSequence,
      accountNumber: `${normalizedPrefix}${nextSequence}`,
    };
  }
}