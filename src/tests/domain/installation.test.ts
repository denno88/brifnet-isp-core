import { describe, expect, it } from "vitest";
import { Installation } from "../../domain/installation.js";

describe("Installation", () => {
  it("creates a pending installation", () => {
    const installation = new Installation(
      "installation-1",
      "user-1",
      "KAM100",
      "PENDING",
      new Date(),
    );

    expect(installation.id).toBe("installation-1");
    expect(installation.pppoeUserId).toBe("user-1");
    expect(installation.accountNumber).toBe("KAM100");
    expect(installation.status).toBe("PENDING");
  });

  it("activates a pending installation", () => {
    const installation = new Installation(
      "installation-1",
      "user-1",
      "KAM100",
      "PENDING",
      new Date(),
    );

    installation.activate();

    expect(installation.status).toBe("ACTIVE");
  });
});