import { randomUUID } from "node:crypto";

import { Installation } from "../../domain/installation.js";

import type { TransactionManager } from "../ports/transaction-manager.js";

export interface CreateInstallationInput {
  pppoeUserId: string;
  accountPrefix: string;
}

export class CreateInstallation {
  constructor(
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    input: CreateInstallationInput,
  ): Promise<Installation> {
    return this.transactionManager.run(
      async ({
        pppoeUserRepository,
        accountNumberAllocator,
        installationRepository,
      }) => {
        const user = await pppoeUserRepository.findById(
          input.pppoeUserId,
        );

        if (!user) {
          throw new Error(
            "PPPoE user not found",
          );
        }

        const allocation =
          await accountNumberAllocator.allocate(
            input.accountPrefix,
          );

        const installation = new Installation(
          randomUUID(),
          user.id,
          allocation.accountNumber,
          "PENDING",
          new Date(),
        );

        await installationRepository.create(
          installation,
          allocation,
        );

        return installation;
      },
    );
  }
}