export type PaymentIntentChannel =
  | "STK"
  | "C2B";

export type PaymentIntentStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export class PaymentIntent {
  constructor(
    public readonly id: string,
    public readonly installationId: string,
    public readonly subscriptionId: string,
    public readonly productId: string,
    public readonly reference: string,
    public readonly amount: number,
    public readonly phone: string,
    public readonly channel: PaymentIntentChannel,
    private _status: PaymentIntentStatus,
    public readonly createdAt: Date,
    public readonly expiresAt: Date | null,
    private _providerReference: string | null,
    private _checkoutRequestId: string | null,
  ) {}

  get status(): PaymentIntentStatus {
    return this._status;
  }

  get providerReference(): string | null {
    return this._providerReference;
  }

  get checkoutRequestId(): string | null {
    return this._checkoutRequestId;
  }

  attachProviderDetails(
    providerReference: string,
    checkoutRequestId: string,
  ): void {
    if (this._status !== "PENDING") {
      return;
    }

    this._providerReference = providerReference;
    this._checkoutRequestId = checkoutRequestId;
  }

  complete(): void {
    if (this._status !== "PENDING") {
      return;
    }

    this._status = "COMPLETED";
  }

  fail(): void {
    if (this._status !== "PENDING") {
      return;
    }

    this._status = "FAILED";
  }

  expire(): void {
    if (this._status !== "PENDING") {
      return;
    }

    this._status = "EXPIRED";
  }

  cancel(): void {
    if (this._status !== "PENDING") {
      return;
    }

    this._status = "CANCELLED";
  }
}