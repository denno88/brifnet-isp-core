import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  CompleteC2bPayment,
} from "../../../application/payments/complete-c2b-payment.js";

import {
  Installation,
} from "../../../domain/installation.js";

import {
  Payment,
} from "../../../domain/payment.js";

import {
  Product,
} from "../../../domain/product.js";

import {
  Subscription,
} from "../../../domain/subscription.js";

import type {
  TransactionContext,
} from "../../../application/ports/transaction-manager.js";

import type {
  TransactionManager,
} from "../../../application/ports/transaction-manager.js";


function createContext(): TransactionContext {
  const installation = new Installation(
    "installation-1",
    "user-1",
    "KAM100",
    "ACTIVE",
    new Date("2026-01-01T09:00:00Z"),
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
        sequence: 101,
        accountNumber: "KAM101",
      }),
    },

    installationRepository: {
      create: async () => {},

      findById: async () => installation,

      findByIdForUpdate: async () => installation,

      findByAccountNumber: async (accountNumber: string) => {
        if (accountNumber !== installation.accountNumber) {
          return null;
        }

        return installation;
      },

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

      findByPrice: async (price: number) => {
        if (price !== product.price) {
          return [];
        }

        return [product];
      },

      save: async () => {},
    },

    subscriptionRepository: {
      create: async () => {},

      findById: async () => subscription,

      findByIdForUpdate: async () => subscription,

      findActiveByInstallationId: async () => subscription,

      findRenewableByInstallationId: async () => subscription,

      findRenewableByInstallationIdForUpdate: async () => subscription,

      save: async () => {},
    },

    paymentIntentRepository: {
      create: async () => {},

      findById: async () => null,

      findByReference: async () => null,

      findByReferenceForUpdate: async () => null,

      findByCheckoutRequestId: async () => null,

      findPendingByInstallationId: async () => null,
      
      attachProviderDetails: async () => true,

      save: async () => {},
    },

    paymentRepository: {
      create: async (payment: Payment) => {
        storedPayment = payment;
      },

      createOrGetByProviderTransactionId: async (payment: Payment) => {
        /*
         * This fake reproduces the repository contract used by the
         * real PostgreSQL implementation:
         *
         * - First payment with this provider transaction ID is created.
         * - A repeated provider transaction returns the existing payment.
         * - The caller can therefore decide whether the subscription
         *   should be renewed.
         */
        if (
          storedPayment?.providerTransactionId ===
          payment.providerTransactionId
        ) {
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

      findByProviderTransactionId: async (
        providerTransactionId: string,
      ) => {
        if (
          storedPayment?.providerTransactionId ===
          providerTransactionId
        ) {
          return storedPayment;
        }

        return null;
      },

      findByReference: async () => null,

      save: async () => {},
    },

    /* 
    * Unit-test implementation of the transaction savepoint. 
    * *
    * The production implementation creates a PostgreSQL SAVEPOINT, 
    * executes the callback, and rolls back to that savepoint if the 
    * callback fails. 
    * For this unit test we only need the transaction-context contract, 
    *  so executing the callback directly is sufficient. 
    * 
    */
    
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
      work: (context: TransactionContext) => Promise<T>,
    ): Promise<T> {
      /*
       * Unit tests execute the application transaction callback directly.
       *
       * Real PostgreSQL transaction boundaries are tested separately
       * by integration tests.
       */
      return work(context);
    },
  };
}


function createInput() {
  return {
    accountNumber: "KAM100",
    amount: 349,
    phone: "0712345678",
    providerTransactionId: "SAF-C2B-123456",
    receivedAt: new Date("2026-01-01T10:05:00Z"),
  };
}


describe("CompleteC2bPayment", () => {

  it("creates a C2B payment and renews the subscription", async () => {
    const context = createContext();

    const saveSpy = vi.spyOn(
      context.subscriptionRepository,
      "save",
    );

    const createOrGetSpy = vi.spyOn(
      context.paymentRepository,
      "createOrGetByProviderTransactionId",
    );

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    const payment = await useCase.execute(createInput());

    expect(payment.reference).toMatch(
      /^PAY-C2B-[A-Z0-9]{12}$/,
    );

    expect(payment.reference).not.toBe("KAM100");

    expect(payment.installationId).toBe(
      "installation-1",
    );

    expect(payment.subscriptionId).toBe(
      "subscription-1",
    );

    expect(payment.productId).toBe(
      "product-1",
    );

    expect(payment.amount).toBe(349);

    expect(payment.phone).toBe(
      "0712345678",
    );

    expect(payment.channel).toBe(
      "C2B",
    );

    expect(payment.paymentIntentId).toBeNull();

    expect(payment.providerReference).toBeNull();

    expect(payment.providerTransactionId).toBe(
      "SAF-C2B-123456",
    );

    expect(payment.status).toBe(
      "COMPLETED",
    );

    expect(createOrGetSpy).toHaveBeenCalledTimes(1);

    expect(saveSpy).toHaveBeenCalledTimes(1);

    const savedSubscription =
      saveSpy.mock.calls[0]?.[0];

    expect(savedSubscription).toBeDefined();

    expect(savedSubscription?.status).toBe(
      "ACTIVE",
    );

    expect(savedSubscription?.currentPeriodEnd).toEqual(
      new Date("2026-01-15T10:00:00Z"),
    );
  });

  it("rejects an unknown account number", async () => {
    const context = createContext();

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute({
        ...createInput(),
        accountNumber: "UNKNOWN100",
      }),
    ).rejects.toThrow(
      "Installation not found",
    );
  });


  it("rejects payment for an inactive installation", async () => {
    const context = createContext();

    context.installationRepository.findByAccountNumber =
      async () => {
        return new Installation(
          "installation-1",
          "user-1",
          "KAM100",
          "PENDING",
          new Date("2026-01-01T09:00:00Z"),
        );
      };

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute(createInput()),
    ).rejects.toThrow(
      "Payment can only be applied to an active installation",
    );
  });


  it("rejects payment when there is no renewable subscription", async () => {
    const context = createContext();

    context.subscriptionRepository.findRenewableByInstallationIdForUpdate =
      async () => null;

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute(createInput()),
    ).rejects.toThrow(
      "Renewable subscription not found",
    );
  });


  it("renews a GRACE subscription", async () => {
    const context = createContext();

    const graceSubscription = new Subscription(
      "subscription-1",
      "installation-1",
      "product-1",
      "GRACE",
      new Date("2026-01-01T10:00:00Z"),
      new Date("2026-01-08T10:00:00Z"),
      new Date("2026-01-09T10:00:00Z"),
      new Date("2026-01-01T10:00:00Z"),
    );

    context.subscriptionRepository.findRenewableByInstallationIdForUpdate =
      async () => graceSubscription;

    const saveSpy = vi.spyOn(
      context.subscriptionRepository,
      "save",
    );

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    const payment = await useCase.execute(
      createInput(),
    );

    expect(payment.status).toBe(
      "COMPLETED",
    );

    expect(graceSubscription.status).toBe(
      "ACTIVE",
    );

    expect(graceSubscription.currentPeriodEnd).toEqual(
      new Date("2026-01-15T10:00:00Z"),
    );

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });


  it("rejects a payment when no product matches the amount", async () => {
    const context = createContext();

    context.productRepository.findByPrice =
      async () => [];

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute({
        ...createInput(),
        amount: 999,
      }),
    ).rejects.toThrow(
      "No product matches the payment amount",
    );
  });


  it("rejects a payment when the amount matches multiple products", async () => {
    const context = createContext();

    const secondProduct = new Product(
      "product-2",
      "30 Mbps Weekly",
      "plan-2",
      349,
      7,
      1,
      new Date("2026-01-01T00:00:00Z"),
    );

    context.productRepository.findByPrice =
      async () => [
        context.productRepository.findById
          ? await context.productRepository.findById(
              "product-1",
            )
          : null,
        secondProduct,
      ].filter(
        (product): product is Product =>
          product !== null,
      );

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    await expect(
      useCase.execute(createInput()),
    ).rejects.toThrow(
      "Payment amount matches multiple products",
    );
  });


  it("returns the existing payment for a duplicate provider transaction", async () => {
    const context = createContext();

    const existingPayment = new Payment(
      "payment-existing",
      "installation-1",
      "subscription-1",
      "product-1",
      null,
      "PAY-C2B-EXISTING",
      349,
      "0712345678",
      "C2B",
      null,
      "SAF-C2B-123456",
      "COMPLETED",
      new Date("2026-01-01T10:05:00Z"),
      new Date("2026-01-01T10:05:00Z"),
    );

    context.paymentRepository.findByProviderTransactionId =
      async (
        providerTransactionId: string,
      ) => {
        if (
          providerTransactionId ===
          existingPayment.providerTransactionId
        ) {
          return existingPayment;
        }

        return null;
      };

    const createOrGetSpy = vi.spyOn(
      context.paymentRepository,
      "createOrGetByProviderTransactionId",
    );

    const saveSpy = vi.spyOn(
      context.subscriptionRepository,
      "save",
    );

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    const payment = await useCase.execute(
      createInput(),
    );

    expect(payment).toBe(
      existingPayment,
    );

    expect(payment.reference).toBe(
      "PAY-C2B-EXISTING",
    );

    /*
     * Fast-path duplicate detection happens before attempting
     * payment creation, so the atomic create-or-get operation
     * is not needed here.
     */
    expect(createOrGetSpy).not.toHaveBeenCalled();

    /*
     * Most importantly, the subscription must not be renewed
     * again when the gateway delivers the same transaction twice.
     */
    expect(saveSpy).not.toHaveBeenCalled();
  });


  it("does not renew when create-or-get reports an existing payment", async () => {
    const context = createContext();

    /*
     * This test covers the race-safe repository contract directly.
     *
     * Imagine two callbacks arrive at almost exactly the same time:
     *
     * callback A -> INSERT succeeds
     * callback B -> INSERT conflicts on provider_transaction_id
     *
     * B receives { created: false } and must NOT renew the
     * subscription a second time.
     */
    context.paymentRepository.findByProviderTransactionId =
      async () => null;

    const existingPayment = new Payment(
      "payment-existing",
      "installation-1",
      "subscription-1",
      "product-1",
      null,
      "PAY-C2B-EXISTING",
      349,
      "0712345678",
      "C2B",
      null,
      "SAF-C2B-123456",
      "COMPLETED",
      new Date("2026-01-01T10:05:00Z"),
      new Date("2026-01-01T10:05:00Z"),
    );

    context.paymentRepository.createOrGetByProviderTransactionId =
      async () => ({
        payment: existingPayment,
        created: false,
      });

    const saveSpy = vi.spyOn(
      context.subscriptionRepository,
      "save",
    );

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    const payment = await useCase.execute(
      createInput(),
    );

    expect(payment).toBe(
      existingPayment,
    );

    expect(payment.providerTransactionId).toBe(
      "SAF-C2B-123456",
    );

    expect(saveSpy).not.toHaveBeenCalled();
  });


  it("renews only once when the same C2B callback is processed twice", async () => {
    const context = createContext();

    const useCase = new CompleteC2bPayment(
      createTransactionManager(context),
    );

    const firstPayment = await useCase.execute(
      createInput(),
    );

    const firstEnd = new Date(
      context.subscriptionRepository.findRenewableByInstallationId
        ? (
            await context.subscriptionRepository
              .findRenewableByInstallationId(
                "installation-1",
              )
          )?.currentPeriodEnd ?? 0
        : 0,
    );

    /*
     * Simulate a second delivery of the exact same
     * provider transaction.
     */
    const secondPayment = await useCase.execute(
      createInput(),
    );

    const secondEnd = new Date(
      context.subscriptionRepository.findRenewableByInstallationId
        ? (
            await context.subscriptionRepository
              .findRenewableByInstallationId(
                "installation-1",
              )
          )?.currentPeriodEnd ?? 0
        : 0,
    );

    expect(secondPayment).toBe(
      firstPayment,
    );

    /*
     * The second callback must not extend the subscription
     * another seven days.
     */
    expect(firstEnd).toEqual(
      new Date("2026-01-15T10:00:00Z"),
    );

    expect(secondEnd).toEqual(
      new Date("2026-01-15T10:00:00Z"),
    );
  });

  it("exposes runSavepoint on the transaction context", async () => { 
    const context = createContext(); 
    const result = await context.runSavepoint( 
      async () => "savepoint-result", 
    ); 
    expect(result).toBe( 
      "savepoint-result", 
    ); 
  });
});
