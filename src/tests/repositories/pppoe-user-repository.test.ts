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
import { PppoeUserRepository } from "../../repositories/pppoe-user-repository.js";
import { PppoeUser } from "../../domain/pppoe-user.js";

describe("PppoeUserRepository", () => {
  const repository = new PppoeUserRepository();

  let userId: string;

  beforeEach(() => {
    userId = randomUUID();
  });

  afterEach(async () => {
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

  it("creates and retrieves a PPPoE user", async () => {
    const user = new PppoeUser(
      userId,
      "Repository Test",
      "0711111111",
      "ACTIVE",
      new Date("2026-09-17T00:00:00Z"),
    );

    await repository.create(user);

    const savedUser = await repository.findById(user.id);

    expect(savedUser).not.toBeNull();
    expect(savedUser?.id).toBe(user.id);
    expect(savedUser?.name).toBe("Repository Test");
    expect(savedUser?.phone).toBe("0711111111");
    expect(savedUser?.status).toBe("ACTIVE");
  });

  it("returns null when the user does not exist", async () => {
    const user = await repository.findById(randomUUID());

    expect(user).toBeNull();
  });

  it("updates a user's domain changes", async () => {
    const user = new PppoeUser(
      userId,
      "Original Name",
      "0722222222",
      "ACTIVE",
      new Date("2026-09-17T00:00:00Z"),
    );

    await repository.create(user);

    user.changeName("Updated Name");
    user.changePhone("0733333333");
    user.suspend();

    await repository.save(user);

    const savedUser = await repository.findById(user.id);

    expect(savedUser?.name).toBe("Updated Name");
    expect(savedUser?.phone).toBe("0733333333");
    expect(savedUser?.status).toBe("SUSPENDED");
  });
});