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
import { InstallationRepository } from "../../repositories/installation-repository.js";
import { Installation } from "../../domain/installation.js";

describe("InstallationRepository", () => {
  const repository = new InstallationRepository();

  let userId: string;
  let installationId: string;
  let accountNumber: string;

  beforeEach(() => {
    userId = randomUUID();
    installationId = randomUUID();
    accountNumber = `BRF-INSTALL-${randomUUID()}`;
  });

  afterEach(async () => {
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

  async function createUser(): Promise<void> {
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
        "Installation Test",
        "0711111111",
        "ACTIVE",
        new Date("2026-09-17T00:00:00Z"),
      ],
    );
  }

  it("creates and retrieves an installation", async () => {
    await createUser();

    const installation = new Installation(
      installationId,
      userId,
      accountNumber,
      "PENDING",
      new Date("2026-09-17T00:00:00Z"),
    );

    await repository.create(installation, {
      prefix: "KAM",
      sequence: 1001,
      accountNumber: "KAM1001",
    });

    const savedInstallation = await repository.findById(installation.id);

    expect(savedInstallation).not.toBeNull();
    expect(savedInstallation?.id).toBe(installation.id);
    expect(savedInstallation?.pppoeUserId).toBe(userId);
    expect(savedInstallation?.status).toBe("PENDING");
  });

  it("returns null when an installation does not exist", async () => {
    const installation = await repository.findById(randomUUID());

    expect(installation).toBeNull();
  });

  it("persists installation activation", async () => {
    await createUser();

    const installation = new Installation(
      installationId,
      userId,
      accountNumber,
      "PENDING",
      new Date("2026-09-17T00:00:00Z"),
    );

    await repository.create(installation, {
      prefix: "KAM",
      sequence: 1002,
      accountNumber: "KAM1002",
    });

    installation.activate();

    await repository.save(installation);

    const savedInstallation = await repository.findById(installation.id);

    expect(savedInstallation?.status).toBe("ACTIVE");
  });
});