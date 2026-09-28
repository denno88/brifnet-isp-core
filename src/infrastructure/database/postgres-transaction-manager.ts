import pool from "../../config/database.js";
import type { PoolClient } from "pg";

import {
  PostgresAccountNumberAllocator,
} from "../account-numbers/postgres-account-number-allocator.js";

import {
  InstallationRepository,
} from "../../repositories/installation-repository.js";

import {
  PppoeUserRepository,
} from "../../repositories/pppoe-user-repository.js";

import {
  CredentialRepository,
} from "../../repositories/credential-repository.js"

import {
  ProductRepository,
} from "../../repositories/product-repository.js";

import {
  SubscriptionRepository,
} from "../../repositories/subscription-repository.js";

import {
  PaymentIntentRepository,
} from "../../repositories/payment-intent-repository.js";

import {
  PaymentRepository,
} from "../../repositories/payment-repository.js";

import type {
  TransactionContext,
  TransactionManager,
} from "../../application/ports/transaction-manager.js";


export class PostgresTransactionManager
  implements TransactionManager
{
  async run<T>(
    work: (context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const client: PoolClient = await pool.connect();

    let savepointCounter = 0;

    const runSavepoint = async <T>(
      work: () => Promise<T>,
    ): Promise<T> => {
      const savepointName =
        `payment_insert_${++savepointCounter}`;

      await client.query(
        `SAVEPOINT ${savepointName}`,
      );

      try {
        const result = await work();

        await client.query(
          `RELEASE SAVEPOINT ${savepointName}`,
        );

        return result;
      } catch (error) {
        await client.query(
          `ROLLBACK TO SAVEPOINT ${savepointName}`,
        );

        await client.query(
          `RELEASE SAVEPOINT ${savepointName}`,
        );

        throw error;
      }
    };

    try {
      await client.query("BEGIN");

      const context: TransactionContext = {
        accountNumberAllocator:
          new PostgresAccountNumberAllocator(client),

        installationRepository:
          new InstallationRepository(client),

        pppoeUserRepository:
          new PppoeUserRepository(client),

        credentialRepository:
          new CredentialRepository(client),

        productRepository:
          new ProductRepository(client),

        subscriptionRepository:
          new SubscriptionRepository(client),
          
        paymentIntentRepository:
          new PaymentIntentRepository(client),

        paymentRepository:
          new PaymentRepository(client),
        
        runSavepoint,
        };

      const result = await work(context);

      await client.query("COMMIT");

      return result;
    } catch (error) {
      await client.query("ROLLBACK");

      throw error;
    } finally {
      client.release();
    }
  }
}