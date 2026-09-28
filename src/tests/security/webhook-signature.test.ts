import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  verifyWebhookSignature,
} from "../../security/webhook-signature.js";

describe("verifyWebhookSignature", () => {
  const secret = "test-webhook-secret";

  const body = Buffer.from(
    JSON.stringify({
      event: "payment.completed",
      data: {
        reference: "PAY-001",
        amount: 100,
      },
    }),
  );

  function sign(body: Buffer): string {
    return createHmac("sha256", secret)
      .update(body)
      .digest("hex");
  }

  it("accepts a valid signature", () => {
    const signature = sign(body);

    expect(
      verifyWebhookSignature(
        body,
        signature,
        secret,
      ),
    ).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(
      verifyWebhookSignature(
        body,
        "invalid-signature",
        secret,
      ),
    ).toBe(false);
  });

  it("rejects a signature generated from a different body", () => {
    const signature = sign(body);

    const differentBody = Buffer.from(
      JSON.stringify({
        event: "payment.completed",
        data: {
          reference: "PAY-999",
          amount: 999,
        },
      }),
    );

    expect(
      verifyWebhookSignature(
        differentBody,
        signature,
        secret,
      ),
    ).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(
      verifyWebhookSignature(
        body,
        "",
        secret,
      ),
    ).toBe(false);
  });

  it("rejects a missing secret", () => {
    const signature = sign(body);

    expect(
      verifyWebhookSignature(
        body,
        signature,
        "",
      ),
    ).toBe(false);
  });
});