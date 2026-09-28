import { randomUUID } from "node:crypto";

import { Credential } from "../../domain/credential.js";

import type { CredentialGenerator } from "../ports/credential-generator.js";
import type { TransactionManager } from "../ports/transaction-manager.js";

export interface CreateCredentialInput {
  installationId: string;
}

export class CreateCredential {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly credentialGenerator: CredentialGenerator,
  ) {}

  async execute(
    input: CreateCredentialInput,
  ): Promise<Credential> {
    return this.transactionManager.run(
      async ({
        installationRepository,
        credentialRepository,
      }) => {
        const installation =
          await installationRepository.findById(
            input.installationId,
          );

        if (!installation) {
          throw new Error(
            "Installation not found",
          );
        }

        if (installation.status !== "ACTIVE") {
          throw new Error(
            "Credentials can only be created for active installations",
          );
        }

        const existingCredential =
          await credentialRepository.findActiveByInstallationId(
            installation.id,
          );

        if (existingCredential) {
          throw new Error(
            "Installation already has an active credential",
          );
        }

        const generated =
          this.credentialGenerator.generate(
            installation.accountNumber,
          );

        const credential = new Credential(
          randomUUID(),
          installation.id,
          generated.username,
          generated.password,
          "ACTIVE",
          new Date(),
        );

        await credentialRepository.create(
          credential,
        );

        return credential;
      },
    );
  }
}