import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PaymentIntent,
} from "../../domain/payment-intent.js";

describe("PaymentIntent", () => {
  function createIntent() {
    const createdAt = new Date();
    const expiresAt = new Date(
      createdAt.getTime() + 5 * 60 * 1000,
    );

    return new PaymentIntent(
      "intent-1",
      "installation-1",
      "subscription-1",
      "product-1",
      "PAY-ABC123",
      349,
      "0712345678",
      "STK",
      "PENDING",
      createdAt,
      expiresAt,
      null,
      null,
    );
  }

  it("starts as pending", () => {
    const intent = createIntent();

    expect(intent.status).toBe(
      "PENDING",
    );
  });

  it("can be completed", () => {
    const intent = createIntent();

    intent.complete();

    expect(intent.status).toBe(
      "COMPLETED",
    );
  });

  it("can be marked failed", () => {
    const intent = createIntent();

    intent.fail();

    expect(intent.status).toBe(
      "FAILED",
    );
  });

  it("can expire", () => {
    const intent = createIntent();

    intent.expire();

    expect(intent.status).toBe(
      "EXPIRED",
    );
  });

  it("can be cancelled", () => {
    const intent = createIntent();

    intent.cancel();

    expect(intent.status).toBe(
      "CANCELLED",
    );
  });

  it("does not change a completed intent", () => {
    const intent = createIntent();

    intent.complete();
    intent.fail();
    intent.expire();
    intent.cancel();

    expect(intent.status).toBe(
      "COMPLETED",
    );
  });

  it("does not change a failed intent", () => {
    const intent = createIntent();

    intent.fail();
    intent.complete();
    intent.expire();
    intent.cancel();

    expect(intent.status).toBe(
      "FAILED",
    );
  });

  it("does not change an expired intent", () => {
    const intent = createIntent();

    intent.expire();
    intent.complete();
    intent.fail();
    intent.cancel();

    expect(intent.status).toBe(
      "EXPIRED",
    );
  });

  it("does not change a cancelled intent", () => {
    const intent = createIntent();

    intent.cancel();
    intent.complete();
    intent.fail();
    intent.expire();

    expect(intent.status).toBe(
      "CANCELLED",
    );
  });

  it("can attach provider details", () => {
    const intent = createIntent();

    intent.attachProviderDetails(
        "provider-ref-123",
        "checkout-123",
    );

    expect(
        intent.providerReference,
    ).toBe("provider-ref-123");

    expect(
        intent.checkoutRequestId,
    ).toBe("checkout-123");
    });

  it("does not attach provider details to a completed intent", () => {
        const intent = createIntent();

        intent.complete();

        intent.attachProviderDetails(
            "provider-ref-123",
            "checkout-123",
        );

        expect(
            intent.providerReference,
        ).toBeNull();

        expect(
            intent.checkoutRequestId,
        ).toBeNull();
    });
});