import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { randomUUID } from "node:crypto";

import pool from "../../../config/database.js";

import { CreateInstallation } from "../../../application/installations/create-installation.js";

import { PostgresTransactionManager } from "../../../infrastructure/database/postgres-transaction-manager.js";

describe("CreateInstallation", () => {
  const transactionManager =
    new PostgresTransactionManager();

  const useCase =
    new CreateInstallation(transactionManager);

  let userId: string;

  beforeEach(async () => {
    userId = randomUUID();

    await pool.query(
      `
        INSERT INTO pppoe_users (
          id,
          name,
          phone,
          status
        )
        VALUES ($1, $2, $3, $4)
      `,
      [
        userId,
        "Create Installation Test",
        "0712345678",
        "ACTIVE",
      ],
    );
  });

  afterEach(async () => {
    await pool.query(
      `
        DELETE FROM pppoe_installations
        WHERE pppoe_user_id = $1
      `,
      [userId],
    );

    await pool.query(
      `
        DELETE FROM pppoe_users
        WHERE id = $1
      `,
      [userId],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a pending installation with an allocated account number", async () => {
    const installation = await useCase.execute({
      pppoeUserId: userId,
      accountPrefix: `TST${randomUUID()
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase()}`,
    });

    expect(installation.id).toBeDefined();

    expect(installation.pppoeUserId).toBe(
      userId,
    );

    expect(installation.status).toBe(
      "PENDING",
    );

    expect(installation.accountNumber).toMatch(
      /^TST[A-F0-9]{8}100$/,
    );

    const result = await pool.query(
      `
        SELECT
          id,
          pppoe_user_id,
          account_prefix,
          account_sequence,
          account_number,
          status
        FROM pppoe_installations
        WHERE id = $1
      `,
      [installation.id],
    );

    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];

    expect(row?.pppoe_user_id).toBe(
      userId,
    );

    expect(row?.account_sequence).toBe(100);

    expect(row?.account_number).toBe(
      installation.accountNumber,
    );

    expect(row?.status).toBe("PENDING");
  });

  it("fails when the PPPoE user does not exist", async () => {
    const missingUserId = randomUUID();

    const accountPrefix = `TST${randomUUID()
      .replaceAll("-", "")
      .slice(0, 8)
      .toUpperCase()}`;

    await expect(
      useCase.execute({
        pppoeUserId: missingUserId,
        accountPrefix,
      }),
    ).rejects.toThrow(
      "PPPoE user not found",
    );

    const result = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM pppoe_installations
        WHERE account_prefix = $1
      `,
      [accountPrefix],
    );

    expect(result.rows[0]?.count).toBe(0);
  });

  it("allocates unique account numbers under concurrent creation", async () => {
        const accountPrefix = `CON${randomUUID()
            .replaceAll("-", "")
            .slice(0, 8)
            .toUpperCase()}`;

        const requests = Array.from(
            { length: 10 },
            () =>
            useCase.execute({
                pppoeUserId: userId,
                accountPrefix,
            }),
        );

        const installations = await Promise.all(
            requests,
        );

        expect(installations).toHaveLength(10);

        const accountNumbers = installations.map(
            (installation) =>
            installation.accountNumber,
        );

        const uniqueAccountNumbers = new Set(
            accountNumbers,
        );

        expect(uniqueAccountNumbers.size).toBe(10);

        const sequences = installations
            .map((installation) => {
            const sequenceText =
                installation.accountNumber.slice(
                accountPrefix.length,
                );

            return Number(sequenceText);
            })
            .sort((a, b) => a - b);

        expect(sequences).toEqual([
            100,
            101,
            102,
            103,
            104,
            105,
            106,
            107,
            108,
            109,
        ]);

        const result = await pool.query(
            `
            SELECT
                account_prefix,
                account_sequence,
                account_number
            FROM pppoe_installations
            WHERE pppoe_user_id = $1
                AND account_prefix = $2
            ORDER BY account_sequence
            `,
            [userId, accountPrefix],
        );

        expect(result.rows).toHaveLength(10);

        expect(
            result.rows.map(
            (row) => row.account_sequence,
            ),
        ).toEqual([
            100,
            101,
            102,
            103,
            104,
            105,
            106,
            107,
            108,
            109,
        ]);
    });
});