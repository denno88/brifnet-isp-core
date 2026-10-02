import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export function createWebhookSignature(
  timestamp: string,
  rawBody: Buffer,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(
      `${timestamp}.${rawBody.toString("utf8")}`,
    )
    .digest("hex");
}

export function verifyWebhookSignature(
  timestamp: string,
  rawBody: Buffer,
  suppliedSignature: string,
  secret: string,
): boolean {
  const expectedSignature =
    createWebhookSignature(
      timestamp,
      rawBody,
      secret,
    );

  const normalizedSignature =
    suppliedSignature.startsWith("sha256=")
      ? suppliedSignature.slice(
          "sha256=".length,
        )
      : suppliedSignature;

  if (
    !/^[a-fA-F0-9]{64}$/.test(
      normalizedSignature,
    )
  ) {
    return false;
  }

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "hex",
    );

  const suppliedBuffer =
    Buffer.from(
      normalizedSignature,
      "hex",
    );

  if (
    expectedBuffer.length !==
    suppliedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    suppliedBuffer,
  );
}