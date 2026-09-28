import { describe, expect, it } from "vitest";
import { PppoeUser } from "../../domain/pppoe-user.js";

describe("PppoeUser", () => {
  function createUser(): PppoeUser {
    return new PppoeUser(
      "user-001",
      "John Doe",
      "0712345678",
      "ACTIVE",
      new Date("2026-09-01T00:00:00Z"),
    );
  }

  it("creates an active PPPoE user", () => {
    const user = createUser();

    expect(user.id).toBe("user-001");
    expect(user.name).toBe("John Doe");
    expect(user.phone).toBe("0712345678");
    expect(user.status).toBe("ACTIVE");
  });

  it("changes the user's name", () => {
    const user = createUser();

    user.changeName("Jane Doe");

    expect(user.name).toBe("Jane Doe");
  });

  it("changes the user's phone number", () => {
    const user = createUser();

    user.changePhone("0798765432");

    expect(user.phone).toBe("0798765432");
  });

  it("suspends the user", () => {
    const user = createUser();

    user.suspend();

    expect(user.status).toBe("SUSPENDED");
  });

  it("reactivates a suspended user", () => {
    const user = createUser();

    user.suspend();
    user.activate();

    expect(user.status).toBe("ACTIVE");
  });
});