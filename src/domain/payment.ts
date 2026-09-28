export type PaymentChannel =
  | "STK"
  | "C2B";

export type PaymentStatus =
  | "COMPLETED"
  | "REVERSED";

export class Payment {
  constructor(
    public readonly id: string,
    public readonly installationId: string,
    public readonly subscriptionId: string,
    public readonly productId: string,
    public readonly paymentIntentId: string | null,
    public readonly reference: string,
    public readonly amount: number,
    public readonly phone: string,
    public readonly channel: PaymentChannel,
    public readonly providerReference: string | null,
    public readonly providerTransactionId: string,
    private _status: PaymentStatus,
    public readonly receivedAt: Date,
    public readonly createdAt: Date,
  ) {}

  get status(): PaymentStatus {
    return this._status;
  }

  reverse(): void {
    if (this._status !== "COMPLETED") {
      return;
    }

    this._status = "REVERSED";
  }
}