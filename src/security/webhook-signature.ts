import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = createHmac(
    "sha256",
    secret,
  )
    .update(rawBody)
    .digest("hex");

  const received = Buffer.from(
    signature.trim(),
    "utf8",
  );

  const expected = Buffer.from(
    expectedSignature,
    "utf8",
  );

  /*
   * timingSafeEqual prevents the comparison itself from
   * leaking useful timing information.
   *
   * The length check is required because timingSafeEqual
   * throws when the buffers have different lengths.
   */
  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(
    received,
    expected,
  );
}
