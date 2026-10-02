import { describe, expect, it } from "vitest";

import {
  createWebhookSignature,
  verifyWebhookSignature,
} from "../../security/webhook-signature.js";

const SECRET = "test-webhook-secret";
const TIMESTAMP = "2026-10-02T00:15:30+03:00";
const RAW_BODY = Buffer.from(
  JSON.stringify({
    event: "payment.completed",
    reference: "PAY-CB-040",
    amount: 500,
  }),
  "utf8",
);

describe("webhook signature", () => {
  it("creates a deterministic signature", () => {
    const signature = createWebhookSignature(
      TIMESTAMP,
      RAW_BODY,
      SECRET,
    );

    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies a valid signature", () => {
    const signature = createWebhookSignature(
      TIMESTAMP,
      RAW_BODY,
      SECRET,
    );

    expect(
      verifyWebhookSignature(
        TIMESTAMP,
        RAW_BODY,
        signature,
        SECRET,
      ),
    ).toBe(true);
  });

  it("verifies a valid signature with the sha256= prefix", () => {
    const signature = createWebhookSignature(
      TIMESTAMP,
      RAW_BODY,
      SECRET,
    );

    expect(
      verifyWebhookSignature(
        TIMESTAMP,
        RAW_BODY,
        `sha256=${signature}`,
        SECRET,
      ),
    ).toBe(true);
  });

  it("rejects a signature generated with a different secret", () => {
    const signature = createWebhookSignature(
      TIMESTAMP,
      RAW_BODY,
      "wrong-secret",
    );

    expect(
      verifyWebhookSignature(
        TIMESTAMP,
        RAW_BODY,
        signature,
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects a signature when the body is changed", () => {
    const signature = createWebhookSignature(
      TIMESTAMP,
      RAW_BODY,
      SECRET,
    );

    const tamperedBody = Buffer.from(
      JSON.stringify({
        event: "payment.completed",
        reference: "PAY-CB-040",
        amount: 999,
      }),
      "utf8",
    );

    expect(
      verifyWebhookSignature(
        TIMESTAMP,
        tamperedBody,
        signature,
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects a signature when the timestamp changes", () => {
    const signature = createWebhookSignature(
      TIMESTAMP,
      RAW_BODY,
      SECRET,
    );

    expect(
      verifyWebhookSignature(
        "2026-10-02T00:16:30+03:00",
        RAW_BODY,
        signature,
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects malformed signatures", () => {
    expect(
      verifyWebhookSignature(
        TIMESTAMP,
        RAW_BODY,
        "not-a-valid-signature",
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects signatures with an invalid hexadecimal value", () => {
    expect(
      verifyWebhookSignature(
        TIMESTAMP,
        RAW_BODY,
        `sha256=${"z".repeat(64)}`,
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects an incorrectly sized hexadecimal signature", () => {
    expect(
      verifyWebhookSignature(
        TIMESTAMP,
        RAW_BODY,
        `sha256=${"a".repeat(63)}`,
        SECRET,
      ),
    ).toBe(false);
  });
});
