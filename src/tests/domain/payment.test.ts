import { describe, expect, it } from "vitest";

import { Payment } from "../../domain/payment.js";

describe("Payment", () => {
  const createPayment = () =>
    new Payment(
      "payment-1",
      "installation-1",
      "subscription-1",
      "product-1",
      "intent-1",
      "PAY-123",
      349,
      "254700000000",
      "STK",
      "provider-ref-1",
      "provider-tx-1",
      "COMPLETED",
      new Date(),
      new Date(),
    );

  it("starts as completed", () => {
    const payment = createPayment();

    expect(payment.status).toBe(
      "COMPLETED",
    );
  });

  it("can be reversed", () => {
    const payment = createPayment();

    payment.reverse();

    expect(payment.status).toBe(
      "REVERSED",
    );
  });

  it("cannot reverse an already reversed payment", () => {
    const payment = createPayment();

    payment.reverse();
    payment.reverse();

    expect(payment.status).toBe(
      "REVERSED",
    );
  });
});