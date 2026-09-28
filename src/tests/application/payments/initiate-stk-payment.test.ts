import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  InitiateStkPayment,
} from "../../../application/payments/initiate-stk-payment.js";

import {
  Installation,
} from "../../../domain/installation.js";

import {
  Product,
} from "../../../domain/product.js";

import {
  ServicePlan,
} from "../../../domain/service-plan.js";

import {
  Subscription,
} from "../../../domain/subscription.js";

import {
  PaymentIntent,
} from "../../../domain/payment-intent.js";

import type {
  PaymentProvider,
} from "../../../application/ports/payment-provider.js";

import type {
  TransactionContext,
  TransactionManager,
} from "../../../application/ports/transaction-manager.js";

function createFixtures() {
  const installation = new Installation(
    randomUUID(),
    randomUUID(),
    "KAM100",
    "ACTIVE",
    new Date(),
  );

  const servicePlan = new ServicePlan(
    randomUUID(),
    "20 Mbps",
    20,
    10,
    new Date(),
  );

  const product = new Product(
    randomUUID(),
    "20 Mbps Weekly",
    servicePlan.id,
    349,
    7,
    1,
    new Date(),
  );

  const subscription = new Subscription(
    randomUUID(),
    installation.id,
    product.id,
    "ACTIVE",
    new Date(),
    new Date(
      Date.now() +
        7 * 24 * 60 * 60 * 1000,
    ),
    null,
    new Date(),
  );

  return {
    installation,
    servicePlan,
    product,
    subscription,
  };
}

function createContext() {
  const {
    installation,
    product,
    subscription,
  } = createFixtures();

  let pendingIntent: PaymentIntent | null =
    null;

  /*
   * Keep the mocks as explicit Vitest mocks.
   *
   * This matters because individual tests need to change
   * their return values with mockResolvedValue().
   */
  const paymentIntentRepository = {
    create: vi.fn(
      async (
        paymentIntent: PaymentIntent,
      ): Promise<void> => {
        pendingIntent = paymentIntent;
      },
    ),

    findById: vi.fn(
      async (
        id: string,
      ): Promise<PaymentIntent | null> => {
        if (
          pendingIntent &&
          pendingIntent.id === id
        ) {
          return pendingIntent;
        }

        return null;
      },
    ),

    findByReference: vi.fn(
      async (): Promise<PaymentIntent | null> =>
        null,
    ),

    findByReferenceForUpdate: vi.fn(
      async (): Promise<PaymentIntent | null> =>
        null,
    ),

    findByCheckoutRequestId: vi.fn(
      async (): Promise<PaymentIntent | null> =>
        null,
    ),

    findPendingByInstallationId: vi.fn(
      async (): Promise<PaymentIntent | null> =>
        pendingIntent,
    ),

    attachProviderDetails: vi.fn(
      async (
        paymentIntentId: string,
        providerReference: string,
        checkoutRequestId: string,
      ): Promise<boolean> => {
        if (
          !pendingIntent ||
          pendingIntent.id !== paymentIntentId
        ) {
          return false;
        }

        pendingIntent.attachProviderDetails(
          providerReference,
          checkoutRequestId,
        );

        return true;
      },
    ),

    save: vi.fn(
      async (
        paymentIntent: PaymentIntent,
      ): Promise<void> => {
        pendingIntent = paymentIntent;
      },
    ),
  };

  const installationRepository = {
    create: vi.fn(
      async (): Promise<void> => {},
    ),

    findById: vi.fn(
      async (): Promise<Installation | null> =>
        installation,
    ),

    findByIdForUpdate: vi.fn(
      async (): Promise<Installation | null> =>
        installation,
    ),

    findByAccountNumber: vi.fn(
      async (): Promise<Installation | null> =>
        installation,
    ),

    save: vi.fn(
      async (): Promise<void> => {},
    ),
  };

  const subscriptionRepository = {
    create: vi.fn(
      async (): Promise<void> => {},
    ),

    findById: vi.fn(
      async (): Promise<Subscription | null> =>
        subscription,
    ),

    findByIdForUpdate: vi.fn(
      async (): Promise<Subscription | null> =>
        subscription,
    ),

    findActiveByInstallationId: vi.fn(
      async (): Promise<Subscription | null> =>
        subscription,
    ),

    findRenewableByInstallationId: vi.fn(
      async (): Promise<Subscription | null> =>
        subscription,
    ),

    findRenewableByInstallationIdForUpdate:
      vi.fn(
        async (): Promise<Subscription | null> =>
          subscription,
      ),

    save: vi.fn(
      async (): Promise<void> => {},
    ),
  };

  const productRepository = {
    create: vi.fn(
      async (): Promise<void> => {},
    ),

    findById: vi.fn(
      async (): Promise<Product | null> =>
        product,
    ),

    findByPrice: vi.fn(
      async (): Promise<Product[]> =>
        [product],
    ),

    save: vi.fn(
      async (): Promise<void> => {},
    ),
  };

  const context = {
    accountNumberAllocator: {
      allocate: vi.fn(),
    },

    installationRepository,

    pppoeUserRepository: {
      findById: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    },

    credentialRepository: {
      create: vi.fn(),
      findById: vi.fn(),
      findActiveByInstallationId: vi.fn(),
      save: vi.fn(),
    },

    productRepository,

    subscriptionRepository,

    paymentIntentRepository,

    paymentRepository: {
      create: vi.fn(),
      createOrGetByProviderTransactionId:
        vi.fn(),
      findById: vi.fn(),
      findByProviderTransactionId: vi.fn(),
      findByReference: vi.fn(),
      save: vi.fn(),
    },

    runSavepoint: vi.fn(
      async <T>(
        work: () => Promise<T>,
      ): Promise<T> => work(),
    ),
  } as unknown as TransactionContext;

  /*
   * Do not use vi.fn() for the generic run<T>() method.
   *
   * The generic contract must remain:
   *
   * Promise<T> -> Promise<T>
   *
   * This implementation is enough for application unit tests.
   * PostgreSQL transaction behavior is tested separately.
   */
  const transactionManager: TransactionManager = {
    async run<T>(
      work: (
        context: TransactionContext,
      ) => Promise<T>,
    ): Promise<T> {
      return work(context);
    },
  };

  return {
    installation,
    product,
    subscription,
    context,
    transactionManager,
    paymentIntentRepository,
    installationRepository,
    subscriptionRepository,
  };
}

function createPaymentProvider() {
  const paymentProvider: PaymentProvider = {
    initiateStkPayment: vi.fn(
      async () => ({
        providerReference:
          "MERCHANT-REQUEST-001",
        checkoutRequestId:
          "CHECKOUT-REQUEST-001",
      }),
    ),
  };

  return paymentProvider;
}

describe(
  "InitiateStkPayment",
  () => {
    it(
      "creates a payment intent and initiates STK when no pending intent exists",
      async () => {
        const {
          installation,
          subscription,
          product,
          context,
          transactionManager,
          paymentIntentRepository,
        } = createContext();

        paymentIntentRepository
          .findPendingByInstallationId
          .mockResolvedValue(null);

        const paymentProvider =
          createPaymentProvider();

        const useCase =
          new InitiateStkPayment(
            transactionManager,
            paymentProvider,
          );

        const before = Date.now();

        const result =
          await useCase.execute({
            installationId:
              installation.id,
            phone: "0729633304",
          });

        const after = Date.now();

        expect(
          context.installationRepository
            .findByIdForUpdate,
        ).toHaveBeenCalledWith(
          installation.id,
        );

        expect(
          paymentIntentRepository.create,
        ).toHaveBeenCalledTimes(1);

        expect(
          paymentProvider
            .initiateStkPayment,
        ).toHaveBeenCalledTimes(1);

        expect(
          paymentProvider.initiateStkPayment,
        ).toHaveBeenCalledWith({
          reference: result.reference,
          amount: 349,
          phone: "0729633304",
          accountNumber: "KAM100",
          installationId:
            installation.id,
          subscriptionId:
            subscription.id,
          productId:
            product.id,
        });

        expect(
          result.status,
        ).toBe("PENDING");

        expect(
          result.channel,
        ).toBe("STK");

        expect(
          result.phone,
        ).toBe("0729633304");

        expect(
          result.amount,
        ).toBe(349);

        expect(
          result.providerReference,
        ).toBe(
          "MERCHANT-REQUEST-001",
        );

        expect(
          result.checkoutRequestId,
        ).toBe(
          "CHECKOUT-REQUEST-001",
        );

        expect(
          result.expiresAt,
        ).not.toBeNull();

        const expiresAt =
          result.expiresAt!.getTime();

        const expectedMinimum =
          before +
          10 * 60 * 1000;

        const expectedMaximum =
          after +
          10 * 60 * 1000;

        expect(
          expiresAt,
        ).toBeGreaterThanOrEqual(
          expectedMinimum,
        );

        expect(
          expiresAt,
        ).toBeLessThanOrEqual(
          expectedMaximum,
        );
      },
    );

    it(
      "returns the existing pending intent without initiating another STK payment",
      async () => {
        const {
          installation,
          transactionManager,
          paymentIntentRepository,
          subscription,
          product,
        } = createContext();

        const existingIntent =
          new PaymentIntent(
            randomUUID(),
            installation.id,
            subscription.id,
            product.id,
            "PAY-EXISTING",
            product.price,
            "0711111111",
            "STK",
            "PENDING",
            new Date(),
            new Date(
              Date.now() +
                10 * 60 * 1000,
            ),
            "MERCHANT-EXISTING",
            "CHECKOUT-EXISTING",
          );

        paymentIntentRepository
          .findPendingByInstallationId
          .mockResolvedValue(
            existingIntent,
          );

        const paymentProvider =
          createPaymentProvider();

        const useCase =
          new InitiateStkPayment(
            transactionManager,
            paymentProvider,
          );

        const result =
          await useCase.execute({
            installationId:
              installation.id,
            phone: "0729633304",
          });

        expect(result).toBe(
          existingIntent,
        );

        expect(
          paymentProvider
            .initiateStkPayment,
        ).not.toHaveBeenCalled();

        expect(
          paymentIntentRepository.create,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "expires an expired pending intent and creates a new intent",
      async () => {
        const {
          installation,
          transactionManager,
          paymentIntentRepository,
          subscription,
          product,
        } = createContext();

        const expiredIntent =
          new PaymentIntent(
            randomUUID(),
            installation.id,
            subscription.id,
            product.id,
            "PAY-EXPIRED",
            product.price,
            "0711111111",
            "STK",
            "PENDING",
            new Date(
              Date.now() -
                20 * 60 * 1000,
            ),
            new Date(
              Date.now() -
                10 * 60 * 1000,
            ),
            "MERCHANT-OLD",
            "CHECKOUT-OLD",
          );

        paymentIntentRepository
          .findPendingByInstallationId
          .mockResolvedValue(
            expiredIntent,
          );

        const paymentProvider =
          createPaymentProvider();

        const useCase =
          new InitiateStkPayment(
            transactionManager,
            paymentProvider,
          );

        const result =
          await useCase.execute({
            installationId:
              installation.id,
            phone: "0729633304",
          });

        expect(
          expiredIntent.status,
        ).toBe("EXPIRED");

        expect(
          paymentIntentRepository.save,
        ).toHaveBeenCalledWith(
          expiredIntent,
        );

        expect(
          paymentIntentRepository.create,
        ).toHaveBeenCalledTimes(1);

        expect(result).not.toBe(
          expiredIntent,
        );

        expect(
          result.status,
        ).toBe("PENDING");

        expect(
          paymentProvider
            .initiateStkPayment,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      "marks the payment intent as failed when gateway initiation fails",
      async () => {
        const {
          installation,
          transactionManager,
          paymentIntentRepository,
        } = createContext();

        paymentIntentRepository
          .findPendingByInstallationId
          .mockResolvedValue(null);

        const paymentProvider: PaymentProvider =
          {
            initiateStkPayment: vi.fn(
              async () => {
                throw new Error(
                  "Gateway unavailable",
                );
              },
            ),
          };

        const useCase =
          new InitiateStkPayment(
            transactionManager,
            paymentProvider,
          );

        await expect(
          useCase.execute({
            installationId:
              installation.id,
            phone: "0729633304",
          }),
        ).rejects.toThrow(
          "Gateway unavailable",
        );

        expect(
          paymentIntentRepository.create,
        ).toHaveBeenCalledTimes(1);

        expect(
          paymentIntentRepository.save,
        ).toHaveBeenCalledTimes(1);

        const savedIntent =
          paymentIntentRepository
            .save.mock.calls[0]?.[0];

        expect(
          savedIntent,
        ).toBeDefined();

        expect(
          savedIntent?.status,
        ).toBe("FAILED");
      },
    );

    it(
      "does not initiate STK for an inactive installation",
      async () => {
        const {
          installationRepository,
          transactionManager,
        } = createContext();

        const inactiveInstallation =
          new Installation(
            randomUUID(),
            randomUUID(),
            "KAM101",
            "PENDING",
            new Date(),
          );

        installationRepository
          .findByIdForUpdate
          .mockResolvedValue(
            inactiveInstallation,
          );

        const paymentProvider =
          createPaymentProvider();

        const useCase =
          new InitiateStkPayment(
            transactionManager,
            paymentProvider,
          );

        await expect(
          useCase.execute({
            installationId:
              inactiveInstallation.id,
            phone: "0729633304",
          }),
        ).rejects.toThrow(
          "Payment can only be initiated for an active installation",
        );

        expect(
          paymentProvider
            .initiateStkPayment,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects payment initiation when the installation does not exist",
      async () => {
        const {
          installationRepository,
          transactionManager,
        } = createContext();

        installationRepository
          .findByIdForUpdate
          .mockResolvedValue(null);

        const paymentProvider =
          createPaymentProvider();

        const useCase =
          new InitiateStkPayment(
            transactionManager,
            paymentProvider,
          );

        await expect(
          useCase.execute({
            installationId:
              randomUUID(),
            phone: "0729633304",
          }),
        ).rejects.toThrow(
          "Installation not found",
        );

        expect(
          paymentProvider
            .initiateStkPayment,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects payment initiation when no renewable subscription exists",
      async () => {
        const {
          installation,
          subscriptionRepository,
          transactionManager,
          paymentIntentRepository,
        } = createContext();

        paymentIntentRepository
          .findPendingByInstallationId
          .mockResolvedValue(null);

        subscriptionRepository
          .findRenewableByInstallationId
          .mockResolvedValue(null);

        const paymentProvider =
          createPaymentProvider();

        const useCase =
          new InitiateStkPayment(
            transactionManager,
            paymentProvider,
          );

        await expect(
          useCase.execute({
            installationId:
              installation.id,
            phone: "0729633304",
          }),
        ).rejects.toThrow(
          "Renewable subscription not found",
        );

        expect(
          paymentProvider
            .initiateStkPayment,
        ).not.toHaveBeenCalled();

        expect(
          paymentIntentRepository.create,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
