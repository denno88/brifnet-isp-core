import { randomUUID } from "node:crypto";

import { Credential } from "../../domain/credential.js";

import type { CredentialGenerator } from "../ports/credential-generator.js";
import type { TransactionManager } from "../ports/transaction-manager.js";

export interface ActivateInstallationInput {
  installationId: string;
}

export class ActivateInstallation {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly credentialGenerator: CredentialGenerator,
  ) {}

  async execute(
    input: ActivateInstallationInput,
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

        if (installation.status !== "PENDING") {
          throw new Error(
            "Only pending installations can be activated",
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

        installation.activate();

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

        await installationRepository.save(
          installation,
        );

        await credentialRepository.create(
          credential,
        );

        return credential;
      },
    );
  }
}