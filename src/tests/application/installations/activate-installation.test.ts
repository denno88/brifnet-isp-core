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

import { Installation } from "../../../domain/installation.js";

import { InstallationRepository } from "../../../repositories/installation-repository.js";

import { PostgresTransactionManager } from "../../../infrastructure/database/postgres-transaction-manager.js";

import { ActivateInstallation } from "../../../application/installations/activate-installation.js";

import { SecureCredentialGenerator } from "../../../infrastructure/credentials/secure-credential-generator.js";
import type { CredentialGenerator } from "../../../application/ports/credential-generator.js";

describe("ActivateInstallation", () => {
  const repository =
    new InstallationRepository();

  const transactionManager =
    new PostgresTransactionManager();

  const crededentialGenerator = 
    new SecureCredentialGenerator;

  const useCase =
    new ActivateInstallation(
      transactionManager,
      crededentialGenerator,
    );

  let userId: string;
  let installationId: string;
  let accountPrefix: string;
  let accountNumber: string;

  beforeEach(async () => {
    userId = randomUUID();
    installationId = randomUUID();

    accountPrefix = `ACT${randomUUID()
      .replaceAll("-", "")
      .slice(0, 8)
      .toUpperCase()}`;

    accountNumber = `${accountPrefix}100`;

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
        "Activation Test",
        "0712345678",
        "ACTIVE",
      ],
    );

    const installation = new Installation(
      installationId,
      userId,
      accountNumber,
      "PENDING",
      new Date(),
    );

    await repository.create(
      installation,
      {
        prefix: accountPrefix,
        sequence: 100,
        accountNumber,
      },
    );
  });

  afterEach(async () => {
    await pool.query(
      `
        DELETE FROM pppoe_credentials
        WHERE installation_id = $1
      `,
      [installationId],
    );

    await pool.query(
      `
        DELETE FROM pppoe_installations
        WHERE id = $1
      `,
      [installationId],
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

  it("activates a pending installation and creates credentials", async () => {
    const credential =
      await useCase.execute({
        installationId,
      });

    expect(credential.installationId).toBe(
      installationId,
    );

    expect(credential.username).toBe(
      accountNumber,
    );

    expect(credential.password).toBeDefined();

    expect(credential.password.length).toBeGreaterThan(
      10,
    );

    expect(credential.status).toBe(
      "ACTIVE",
    );

    const installationResult =
      await pool.query(
        `
          SELECT status
          FROM pppoe_installations
          WHERE id = $1
        `,
        [installationId],
      );

    expect(
      installationResult.rows[0]?.status,
    ).toBe("ACTIVE");

    const credentialResult =
      await pool.query(
        `
          SELECT
            installation_id,
            username,
            password,
            status
          FROM pppoe_credentials
          WHERE installation_id = $1
        `,
        [installationId],
      );

    expect(
      credentialResult.rows,
    ).toHaveLength(1);

    expect(
      credentialResult.rows[0]?.installation_id,
    ).toBe(installationId);

    expect(
      credentialResult.rows[0]?.username,
    ).toBe(accountNumber);

    expect(
      credentialResult.rows[0]?.password,
    ).toBe(credential.password);

    expect(
      credentialResult.rows[0]?.status,
    ).toBe("ACTIVE");
  });

  it("fails when the installation does not exist", async () => {
    await expect(
      useCase.execute({
        installationId: randomUUID(),
      }),
    ).rejects.toThrow(
      "Installation not found",
    );
  });

  it("does not activate an already active installation", async () => {
    await pool.query(
      `
        UPDATE pppoe_installations
        SET status = 'ACTIVE'
        WHERE id = $1
      `,
      [installationId],
    );

    await expect(
      useCase.execute({
        installationId,
      }),
    ).rejects.toThrow(
      "Only pending installations can be activated",
    );
  });

  it("does not activate when an active credential already exists", async () => {
    await pool.query(
      `
        INSERT INTO pppoe_credentials (
          id,
          installation_id,
          username,
          password,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'ACTIVE'
        )
      `,
      [
        randomUUID(),
        installationId,
        accountNumber,
        "ExistingPassword123",
      ],
    );

    await expect(
      useCase.execute({
        installationId,
      }),
    ).rejects.toThrow(
      "Installation already has an active credential",
    );

    const result = await pool.query(
      `
        SELECT status
        FROM pppoe_installations
        WHERE id = $1
      `,
      [installationId],
    );

    expect(result.rows[0]?.status).toBe(
      "PENDING",
    );
  });

  const failingGenerator: CredentialGenerator = {
    generate() {
      throw new Error(
        "Credential generation failed",
      );
    },
  };

  it("rolls back activation when credential generation fails", async () => {
    const failingUseCase =
      new ActivateInstallation(
        transactionManager,
        failingGenerator,
      );

    await expect(
      failingUseCase.execute({
        installationId,
      }),
    ).rejects.toThrow(
      "Credential generation failed",
    );

    const result = await pool.query(
      `
        SELECT status
        FROM pppoe_installations
        WHERE id = $1
      `,
      [installationId],
    );

    expect(result.rows[0]?.status).toBe(
      "PENDING",
    );

    const credentialResult =
      await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM pppoe_credentials
          WHERE installation_id = $1
        `,
        [installationId],
      );

    expect(
      credentialResult.rows[0]?.count,
    ).toBe(0);
  });

});