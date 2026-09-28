import { randomBytes } from "node:crypto";

import type {
  CredentialGenerator,
  GeneratedCredential,
} from "../../application/ports/credential-generator.js";

export class SecureCredentialGenerator
  implements CredentialGenerator
{
  generate(
    accountNumber: string,
  ): GeneratedCredential {
    const username =
      accountNumber.trim().toUpperCase();

    if (!username) {
      throw new Error(
        "Account number is required",
      );
    }

    const password = randomBytes(12)
      .toString("base64url");

    return {
      username,
      password,
    };
  }
}