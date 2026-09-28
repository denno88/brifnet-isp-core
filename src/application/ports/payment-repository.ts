import { Payment } from "../../domain/payment.js";

export interface CreateOrGetPaymentResult {
  payment: Payment;
  created: boolean;
}

export interface PaymentRepository {
  create(payment: Payment): Promise<void>;

  createOrGetByProviderTransactionId(
    payment: Payment,
  ): Promise<CreateOrGetPaymentResult>;

  findById(id: string): Promise<Payment | null>;

  findByProviderTransactionId(
    providerTransactionId: string,
  ): Promise<Payment | null>;

  findByReference(
    reference: string,
  ): Promise<Payment | null>;

  save(payment: Payment): Promise<void>;
}