import type {
  InitiateStkPaymentInput,
  PaymentProvider,
  StkPaymentInitiation,
} from "../../application/ports/payment-provider.js";

export interface BrifNetMpesaGatewayClient {
  initiateStkPayment(input: {
    reference: string;
    amount: number;
    phone: string;
  }): Promise<{
    providerReference: string;
    checkoutRequestId: string;
  }>;
}

export class BrifNetMpesaGateway
  implements PaymentProvider
{
  constructor(
    private readonly client: BrifNetMpesaGatewayClient,
  ) {}

  async initiateStkPayment(
    input: InitiateStkPaymentInput,
  ): Promise<StkPaymentInitiation> {
    return this.client.initiateStkPayment({
      reference: input.reference,
      amount: input.amount,
      phone: input.phone,
    });
  }
}
