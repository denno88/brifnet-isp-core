import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { randomUUID } from "node:crypto";
import pool from "../../config/database.js";
import { CredentialRepository } from "../../repositories/credential-repository.js";
import { Credential } from "../../domain/credential.js";

describe("CredentialRepository", () => {
  const repository = new CredentialRepository();

  let userId: string;
  let installationId: string;
  let credentialId: string;
  let accountNumber: string;
  let username: string;

  beforeEach(() => {
    userId = randomUUID();
    installationId = randomUUID();
    credentialId = randomUUID();

    const uniqueSuffix = randomUUID().slice(0, 8);

    accountNumber = `BRF-CRED-${uniqueSuffix}`;
    username = `brifnet-${uniqueSuffix}`;
  });

  afterEach(async () => {
    await pool.query(
      `
        DELETE FROM pppoe_credentials
        WHERE id = $1
      `,
      [credentialId],
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

  async function createInstallation(): Promise<void> {
    await pool.query(
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
        userId,
        "Credential Test",
        "0711111111",
        "ACTIVE",
        new Date("2026-09-17T00:00:00Z"),
      ],
    );

    await pool.query(
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
        installationId,
        userId,
        'CRED',
        1002,
        accountNumber,
        "ACTIVE",
        new Date("2026-09-17T00:00:00Z"),
      ],
    );
  }

  it("creates and retrieves a credential", async () => {
    await createInstallation();

    const credential = new Credential(
      credentialId,
      installationId,
      username,
      "secret123",
      "ACTIVE",
      new Date("2026-09-17T00:00:00Z"),
    );

    await repository.create(credential);

    const savedCredential = await repository.findById(credential.id);

    expect(savedCredential).not.toBeNull();
    expect(savedCredential?.id).toBe(credential.id);
    expect(savedCredential?.installationId).toBe(installationId);
    expect(savedCredential?.username).toBe(username);
    expect(savedCredential?.password).toBe("secret123");
    expect(savedCredential?.status).toBe("ACTIVE");
  });

  it("returns null when a credential does not exist", async () => {
    const credential = await repository.findById(randomUUID());

    expect(credential).toBeNull();
  });

  it("persists a password change", async () => {
    await createInstallation();

    const credential = new Credential(
      credentialId,
      installationId,
      username,
      "old-password",
      "ACTIVE",
      new Date("2026-09-17T00:00:00Z"),
    );

    await repository.create(credential);

    credential.changePassword("new-password");

    await repository.save(credential);

    const savedCredential = await repository.findById(credential.id);

    expect(savedCredential?.password).toBe("new-password");
    expect(savedCredential?.status).toBe("ACTIVE");
  });

  it("persists credential revocation", async () => {
    await createInstallation();

    const credential = new Credential(
      credentialId,
      installationId,
      username,
      "secret123",
      "ACTIVE",
      new Date("2026-09-17T00:00:00Z"),
    );

    await repository.create(credential);

    credential.revoke();

    await repository.save(credential);

    const savedCredential = await repository.findById(credential.id);

    expect(savedCredential?.status).toBe("REVOKED");
  });
});