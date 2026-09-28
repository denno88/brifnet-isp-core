import { describe, expect, it } from "vitest";
import { Credential } from "../../domain/credential.js";

describe("Credential", () => {
  function createCredential(): Credential {
    return new Credential(
      "credential-001",
      "installation-001",
      "brifnet-user-001",
      "secret123",
      "ACTIVE",
      new Date("2026-09-01T00:00:00Z"),
    );
  }

  it("creates an active credential", () => {
    const credential = createCredential();

    expect(credential.id).toBe("credential-001");
    expect(credential.installationId).toBe("installation-001");
    expect(credential.username).toBe("brifnet-user-001");
    expect(credential.password).toBe("secret123");
    expect(credential.status).toBe("ACTIVE");
  });

  it("changes the password", () => {
    const credential = createCredential();

    credential.changePassword("newSecret456");

    expect(credential.password).toBe("newSecret456");
  });

  it("revokes a credential", () => {
    const credential = createCredential();

    credential.revoke();

    expect(credential.status).toBe("REVOKED");
  });

  it("reactivates a revoked credential", () => {
    const credential = createCredential();

    credential.revoke();
    credential.activate();

    expect(credential.status).toBe("ACTIVE");
  });
});