export interface InitiateStkPaymentInput {
  reference: string;
  amount: number;
  phone: string;
  accountNumber: string;
  installationId: string;
  subscriptionId: string;
  productId: string;
}

export interface StkPaymentInitiation {
  providerReference: string;
  checkoutRequestId: string;
}

export interface PaymentProvider {
  initiateStkPayment(
    input: InitiateStkPaymentInput,
  ): Promise<StkPaymentInitiation>;
}