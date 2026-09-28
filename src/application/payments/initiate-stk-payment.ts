import { randomUUID } from "node:crypto";

import { PaymentIntent } from "../../domain/payment-intent.js";

import type { PaymentProvider } from "../ports/payment-provider.js";
import type { TransactionManager } from "../ports/transaction-manager.js";

export interface InitiateStkPaymentInput {
  installationId: string;

  /*
   * The phone number is supplied by the person initiating payment.
   *
   * It does NOT have to belong to the PPPoE user. Someone else can
   * legitimately pay for the installation using their own M-Pesa line.
   */
  phone: string;
}

interface StkPaymentContext {
  paymentIntent: PaymentIntent;
  accountNumber: string;
  created: boolean;
}

export class InitiateStkPayment {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly paymentProvider: PaymentProvider,
  ) {}

  async execute(
    input: InitiateStkPaymentInput,
  ): Promise<PaymentIntent> {
    const context =
      await this.createPaymentIntent(input);

    /*
    * An existing pending intent means another request already
    * initiated payment for this installation. Never send another
    * STK push.
    */
    if (!context.created) {
      return context.paymentIntent;
    }

    try {
      const providerResult =
        await this.paymentProvider.initiateStkPayment({
          reference:
            context.paymentIntent.reference,
          amount:
            context.paymentIntent.amount,
          phone: input.phone,
          accountNumber:
            context.accountNumber,
          installationId:
            context.paymentIntent.installationId,
          subscriptionId:
            context.paymentIntent.subscriptionId,
          productId:
            context.paymentIntent.productId,
        });

      const attached =
        await this.attachProviderDetails(
          context.paymentIntent.id,
          providerResult.providerReference,
          providerResult.checkoutRequestId,
        );

      if (attached) {
        context.paymentIntent.attachProviderDetails(
          providerResult.providerReference,
          providerResult.checkoutRequestId,
        );
      }

      return context.paymentIntent;
    } catch (error) {
      /*
      * The intent was created before calling the external gateway.
      * If initiation fails, do not leave a permanently pending intent
      * blocking the installation for the next 15 minutes.
      */
      await this.transactionManager.run(
        async ({
          paymentIntentRepository,
        }) => {
          const intent =
            await paymentIntentRepository.findById(
              context.paymentIntent.id,
            );

          if (intent) {
            intent.fail();

            await paymentIntentRepository.save(
              intent,
            );
          }
        },
      );

      throw error;
    }
  }

  private async createPaymentIntent(
    input: InitiateStkPaymentInput,
  ): Promise<StkPaymentContext> {
    return this.transactionManager.run(
      async ({
        installationRepository,
        subscriptionRepository,
        productRepository,
        paymentIntentRepository,
      }) => {
        /*
        * Lock the installation for the duration of this transaction.
        *
        * STK initiation is an installation-scoped operation. Serializing
        * requests for the same installation prevents two simultaneous
        * requests from both observing "no pending intent".
        */
        const installation =
          await installationRepository.findByIdForUpdate(
            input.installationId,
          );

        if (!installation) {
          throw new Error(
            "Installation not found",
          );
        }

        if (installation.status !== "ACTIVE") {
          throw new Error(
            "Payment can only be initiated for an active installation",
          );
        }

        const existingPending =
          await paymentIntentRepository.findPendingByInstallationId(
            installation.id,
          );

        if (existingPending) {
          /*
          * A pending intent may exist in the database after its
          * expiration time. Expiration is a state transition, so
          * perform it before deciding whether a new intent may be created.
          */
          if (
            existingPending.expiresAt !== null &&
            new Date() >= existingPending.expiresAt
          ) {
            existingPending.expire();

            await paymentIntentRepository.save(
              existingPending,
            );
          } else {
            /*
            * Do not create another STK request.
            *
            * Returning the existing intent makes repeated requests
            * idempotent at the installation/payment level.
            */
            return {
              paymentIntent: existingPending,
              accountNumber:
                installation.accountNumber,
              created: false,
            };
          }
        }

        const subscription =
          await subscriptionRepository.findRenewableByInstallationId(
            installation.id,
          );

        if (!subscription) {
          throw new Error(
            "Renewable subscription not found",
          );
        }

        const product =
          await productRepository.findById(
            subscription.productId,
          );

        if (!product) {
          throw new Error(
            "Product not found",
          );
        }

        const now = new Date();

        const expiresAt = new Date(
          now.getTime() +
            10 * 60 * 1000,
        );

        const paymentIntent =
          new PaymentIntent(
            randomUUID(),
            installation.id,
            subscription.id,
            product.id,
            `PAY-${randomUUID()
              .replaceAll("-", "")
              .slice(0, 12)
              .toUpperCase()}`,
            product.price,
            input.phone,
            "STK",
            "PENDING",
            now,
            expiresAt,
            null,
            null,
          );

        await paymentIntentRepository.create(
          paymentIntent,
        );

        return {
          paymentIntent,
          accountNumber:
            installation.accountNumber,
          created: true,
        };
      },
    );
  }

  private async attachProviderDetails(
    paymentIntentId: string,
    providerReference: string,
    checkoutRequestId: string,
  ): Promise<boolean> {
    return this.transactionManager.run(
      async ({
        paymentIntentRepository,
      }) => {
        return paymentIntentRepository.attachProviderDetails(
          paymentIntentId,
          providerReference,
          checkoutRequestId,
        );
      },
    );
  }
}