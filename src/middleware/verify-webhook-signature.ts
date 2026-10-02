import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  verifyWebhookSignature,
} from "../security/webhook-signature.js";

const WEBHOOK_TIMESTAMP_TOLERANCE_MS =
  5 * 60 * 1000;

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

export function createWebhookSignatureMiddleware(
  secret: string,
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const rawRequest =
      req as RawBodyRequest;

    const timestamp =
      req.get("X-BrifNet-Timestamp");

    const signature =
      req.get("X-BrifNet-Signature");

    if (!timestamp) {
      res.status(401).json({
        error:
          "Missing webhook timestamp",
      });

      return;
    }

    if (!signature) {
      res.status(401).json({
        error:
          "Missing webhook signature",
      });

      return;
    }

    if (!rawRequest.rawBody) {
      res.status(400).json({
        error:
          "Raw webhook body is unavailable",
      });

      return;
    }

    const timestampMs =
      Date.parse(timestamp);

    if (Number.isNaN(timestampMs)) {
      res.status(401).json({
        error:
          "Invalid webhook timestamp",
      });

      return;
    }

    const ageMs =
      Math.abs(Date.now() - timestampMs);

    if (
      ageMs >
      WEBHOOK_TIMESTAMP_TOLERANCE_MS
    ) {
      res.status(401).json({
        error:
          "Webhook timestamp is outside the allowed window",
      });

      return;
    }

    const valid =
      verifyWebhookSignature(
        timestamp,
        rawRequest.rawBody,
        signature,
        secret,
      );

    if (!valid) {
      res.status(401).json({
        error:
          "Invalid webhook signature",
      });

      return;
    }

    next();
  };
}