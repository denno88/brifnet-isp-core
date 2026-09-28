import { PaymentIntent } from "../../domain/payment-intent.js";

export interface PaymentIntentRepository {
  create(paymentIntent: PaymentIntent): Promise<void>;

  findById(id: string): Promise<PaymentIntent | null>;

  findByReference(
    reference: string,
  ): Promise<PaymentIntent | null>;

  findByReferenceForUpdate(
    reference: string,
  ): Promise<PaymentIntent | null>;

  findByCheckoutRequestId(
    checkoutRequestId: string,
  ): Promise<PaymentIntent | null>;

  findPendingByInstallationId(
    installationId: string,
  ): Promise<PaymentIntent | null>;

  attachProviderDetails(
    paymentIntentId: string,
    providerReference: string,
    checkoutRequestId: string,
  ): Promise<boolean>;

  save(paymentIntent: PaymentIntent): Promise<void>;
}