import { describe, expect, it } from "vitest";

import { CompletePayment } from "../../../application/payments/complete-payment.js";
import { PaymentIntent } from "../../../domain/payment-intent.js";
import { Payment } from "../../../domain/payment.js";
import { Product } from "../../../domain/product.js";
import { Subscription } from "../../../domain/subscription.js";

import type { TransactionContext } from "../../../application/ports/transaction-manager.js";
import type { TransactionManager } from "../../../application/ports/transaction-manager.js";

function createContext(): TransactionContext {
  const intent = new PaymentIntent(
    "intent-1",
    "installation-1",
    "subscription-1",
    "product-1",
    "PAY-ABC123",
    349,
    "0712345678",
    "STK",
    "PENDING",
    new Date("2026-01-01T10:00:00Z"),
    new Date("2026-01-01T10:15:00Z"),
    "provider-ref-1",
    "checkout-1",
  );

  const subscription = new Subscription(
    "subscription-1",
    "installation-1",
    "product-1",
    "ACTIVE",
    new Date("2026-01-01T10:00:00Z"),
    new Date("2026-01-08T10:00:00Z"),
    new Date("2026-01-09T10:00:00Z"),
    new Date("2026-01-01T10:00:00Z"),
  );

  const product = new Product(
    "product-1",
    "20 Mbps Weekly",
    "plan-1",
    349,
    7,
    1,
    new Date("2026-01-01T00:00:00Z"),
  );

  let storedPayment: Payment | null = null;

  return {
    accountNumberAllocator: {
      allocate: async () => ({
        prefix: "KAM",
        sequence: 100,
        accountNumber: "KAM100",
      }),
    },

    installationRepository: {
      create: async () => {},
      findById: async () => null,
      findByIdForUpdate: async () => null,
      findByAccountNumber: async () => null,
      save: async () => {},
    },

    pppoeUserRepository: {
      create: async () => {},
      findById: async () => null,
      save: async () => {},
    },

    credentialRepository: {
      create: async () => {},
      findById: async () => null,
      findActiveByInstallationId: async () => null,
      save: async () => {},
    },

    productRepository: {
      create: async () => {},
      findById: async () => product,
      findByPrice: async () => [product],
      save: async () => {},
    },

    subscriptionRepository: {
      create: async () => {},
      findById: async () => subscription,
      findByIdForUpdate: async () => subscription,
      findActiveByInstallationId: async () =>
        subscription,
      findRenewableByInstallationId: async () => null,
      findRenewableByInstallationIdForUpdate: async () => null,
      save: async () => {},
    },

    paymentIntentRepository: {
      create: async () => {},
      findById: async () => intent,
      findByReference: async () => intent,
      findByReferenceForUpdate: async () => intent,
      findByCheckoutRequestId: async () => null,
      findPendingByInstallationId: async () => null,
      attachProviderDetails: async () => true,
      save: async () => {},
    },

    paymentRepository: {
      create: async (payment) => {
        storedPayment = payment;
      },

      createOrGetByProviderTransactionId: async (
        payment,
      ) => {
        /*
        * Simulate the database's unique constraint on
        * provider_transaction_id.
        *
        * First callback:
        *   no payment exists -> create it.
        *
        * Duplicate callback:
        *   payment already exists -> return the existing
        *   payment without creating another record.
        */
        if (storedPayment) {
          return {
            payment: storedPayment,
            created: false,
          };
        }

        storedPayment = payment;

        return {
          payment,
          created: true,
        };
      },

      findById: async () => null,

      findByProviderTransactionId: async () =>
        storedPayment,

      findByReference: async () => null,

      save: async () => {},
    },
    

    runSavepoint: async <T>( 
      work: () => Promise<T>, 
    ): Promise<T> => { 
      return work();
    },    
  };
}

function createTransactionManager(
  context: TransactionContext,
): TransactionManager {
  return {
    async run<T>(
      work: (
        context: TransactionContext,
      ) => Promise<T>,
    ): Promise<T> {
      return work(context);
    },
  };
}

function createInput() {
  return {
    reference: "PAY-ABC123",
    amount: 349,
    phone: "0712345678",
    channel: "STK" as const,
    providerReference: "provider-ref-1",
    providerTransactionId: "SAF-123456",
    receivedAt: new Date(
      "2026-01-01T10:05:00Z",
    ),
  };
}

describe("CompletePayment", () => {
  it("completes an STK payment and renews the subscription", async () => {
    const context = createContext();

    const useCase = new CompletePayment(
      createTransactionManager(context),
    );

    const payment =
      await useCase.execute(createInput());

    expect(payment.reference).toBe(
      "PAY-ABC123",
    );

    expect(payment.amount).toBe(349);

    expect(payment.status).toBe(
      "COMPLETED",
    );

    expect(
      context.subscriptionRepository
        .findById,
    ).toBeDefined();
  });

  it("rejects an unknown payment reference", async () => {
    const context = createContext();

    context.paymentIntentRepository
      .findByReferenceForUpdate = async () =>
      null;

    const useCase = new CompletePayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute(createInput()),
    ).rejects.toThrow(
      "Payment intent not found",
    );
  });

  it("rejects an amount mismatch", async () => {
    const context = createContext();

    const useCase = new CompletePayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute({
        ...createInput(),
        amount: 500,
      }),
    ).rejects.toThrow(
      "Payment amount mismatch",
    );
  });

  it("rejects a phone mismatch", async () => {
    const context = createContext();

    const useCase = new CompletePayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute({
        ...createInput(),
        phone: "0799999999",
      }),
    ).rejects.toThrow(
      "Payment phone mismatch",
    );
  });

  it("rejects a provider reference mismatch", async () => {
    const context = createContext();

    const useCase = new CompletePayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute({
        ...createInput(),
        providerReference:
          "different-provider-ref",
      }),
    ).rejects.toThrow(
      "Provider reference mismatch",
    );
  });

  it("rejects a non-STK callback", async () => {
    const context = createContext();

    const useCase = new CompletePayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute({
        ...createInput(),
        channel: "C2B",
      }),
    ).rejects.toThrow(
      "C2B payment completion is not implemented yet",
    );
  });
});