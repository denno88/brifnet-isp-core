import type { AccountNumberAllocator } from "./account-number-allocator.js";
import type { InstallationRepository } from "./installation-repository.js";
import type { PppoeUserRepository } from "./pppoe-user-repository.js";
import type { CredentialRepository } from "./credential-repository.js";
import type { ProductRepository } from "./product-repository.js";
import type { SubscriptionRepository } from "./subscription-repository.js";
import type { PaymentIntentRepository } from "./payment-intent-repository.js";
import type { PaymentRepository } from "./payment-repository.js";

export interface TransactionContext {
  accountNumberAllocator: AccountNumberAllocator;
  installationRepository: InstallationRepository;
  pppoeUserRepository: PppoeUserRepository;
  credentialRepository: CredentialRepository;
  productRepository: ProductRepository;
  subscriptionRepository: SubscriptionRepository;
  paymentIntentRepository: PaymentIntentRepository;
  paymentRepository: PaymentRepository;

  runSavepoint<T>(
    work: () => Promise<T>,
  ): Promise<T>;
}

export interface TransactionManager {
  run<T>(
    work: (context: TransactionContext) => Promise<T>,
  ): Promise<T>;
}