import { createServer } from "node:http";

import express from "express";
import type { AddressInfo } from "node:net";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createWebhooksRouter,
} from "../../routes/webhooks.js";

import {
  createWebhookSignature,
} from "../../security/webhook-signature.js";

const WEBHOOK_SECRET =
  "test-webhook-secret";

function createWebhookTimestamp(): string {
  return new Date().toISOString();
}

function createWebhookHeaders(
  rawBody: string,
  timestamp = createWebhookTimestamp(),
) {
  const signature =
    createWebhookSignature(
      timestamp,
      Buffer.from(rawBody, "utf8"),
      WEBHOOK_SECRET,
    );

  return {
    "X-BrifNet-Timestamp": timestamp,
    "X-BrifNet-Signature":
      `sha256=${signature}`,
  };
}

function createTestApp(
  controller: {
    handlePayment: ReturnType<typeof vi.fn>;
  },
  secret: string,
) {
  const app = express();

  /*
   * The webhook signature covers the exact raw HTTP body.
   *
   * Express normally parses JSON before the route receives it,
   * so capture the raw bytes while express.json() processes the
   * request.
   */
  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        (
          req as typeof req & {
            rawBody?: Buffer;
          }
        ).rawBody = Buffer.from(buffer);
      },
    }),
  );

  app.use(
    "/webhooks",
    createWebhooksRouter(
      controller as never,
      secret,
    ),
  );

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        "statusCode" in err &&
        typeof err.statusCode === "number"
          ? err.statusCode
          : 500;

      res.status(status).json({
        error: err.message,
      });
    },
  );

  return app;
}

async function startTestServer(
  app: express.Express,
): Promise<{
  url: string;
  close: () => void;
}> {
  const server = createServer(app);

  /*
   * Prevent the test server from keeping the Vitest process alive.
   */
  server.unref();

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = server.address();

  if (
    !address ||
    typeof address === "string"
  ) {
    server.close();

    throw new Error(
      "Test server did not expose a TCP address",
    );
  }

  const { port } =
    address as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,

    close: () => {
      /*
       * The response has already been received, so there is no
       * reason for the test to wait for keep-alive connections.
       */
      server.closeAllConnections();
      server.close();
    },
  };
}

describe("POST /webhooks/payment", () => {
  const validStkPayload = {
    event_id: "evt-001",
    event: "payment.completed",
    occurred_at:
      "2026-10-02T00:15:30+03:00",
    data: {
      reference: "PAY-001",
      phone: "0729633304",
      amount: 100,
      channel: "STK",
      provider_reference:
        "MERCHANT-001",
      provider_transaction_id:
        "MPESA-001",
    },
  };

  it(
    "accepts a valid signature and valid payload",
    async () => {
      const controller = {
        handlePayment: vi.fn(
          async (_req, res) => {
            res.status(200).json({
              received: true,
              payment: {
                id: "payment-001",
                reference: "PAY-001",
                status: "COMPLETED",
              },
            });
          },
        ),
      };

      const app = createTestApp(
        controller,
        WEBHOOK_SECRET,
      );

      const testServer =
        await startTestServer(app);

      try {
        const body =
          JSON.stringify(
            validStkPayload,
          );

        const response =
          await fetch(
            `${testServer.url}/webhooks/payment`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                "Connection": "close",
                ...createWebhookHeaders(
                  body,
                ),
              },
              body,
              signal:
                AbortSignal.timeout(2_000),
            },
          );

        expect(
          response.status,
        ).toBe(200);

        expect(
          await response.json(),
        ).toEqual({
          received: true,
          payment: {
            id: "payment-001",
            reference: "PAY-001",
            status: "COMPLETED",
          },
        });

        expect(
          controller.handlePayment,
        ).toHaveBeenCalledOnce();
      } finally {
        testServer.close();
      }
    },
  );

  it(
    "rejects an invalid signature with 401",
    async () => {
      const controller = {
        handlePayment: vi.fn(),
      };

      const app = createTestApp(
        controller,
        WEBHOOK_SECRET,
      );

      const testServer =
        await startTestServer(app);

      try {
        const body =
          JSON.stringify(
            validStkPayload,
          );

        const response =
          await fetch(
            `${testServer.url}/webhooks/payment`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                "X-BrifNet-Timestamp":
                createWebhookTimestamp(),
                "X-BrifNet-Signature":
                  `sha256=${"0".repeat(64)}`,
              },
              body,
            },
          );

        expect(
          response.status,
        ).toBe(401);

        expect(
          await response.json(),
        ).toEqual({
          error:
            "Invalid webhook signature",
        });

        expect(
          controller.handlePayment,
        ).not.toHaveBeenCalled();
      } finally {
        testServer.close();
      }
    },
  );

  it(
    "rejects a missing signature with 401",
    async () => {
      const controller = {
        handlePayment: vi.fn(),
      };

      const app = createTestApp(
        controller,
        WEBHOOK_SECRET,
      );

      const testServer =
        await startTestServer(app);

      try {
        const body =
          JSON.stringify(
            validStkPayload,
          );

        const response =
          await fetch(
            `${testServer.url}/webhooks/payment`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                "X-BrifNet-Timestamp":
                createWebhookTimestamp(),
              },
              body,
            },
          );

        expect(
          response.status,
        ).toBe(401);

        expect(
          await response.json(),
        ).toEqual({
          error:
            "Missing webhook signature",
        });

        expect(
          controller.handlePayment,
        ).not.toHaveBeenCalled();
      } finally {
        testServer.close();
      }
    },
  );

  it(
    "rejects an invalid payload with 422 after signature verification",
    async () => {
      const controller = {
        handlePayment: vi.fn(),
      };

      const app = createTestApp(
        controller,
        WEBHOOK_SECRET,
      );

      const testServer =
        await startTestServer(app);

      try {
        const invalidPayload = {
          ...validStkPayload,
          data: {
            ...validStkPayload.data,
            amount: -100,
          },
        };

        const body =
          JSON.stringify(
            invalidPayload,
          );

        const response =
          await fetch(
            `${testServer.url}/webhooks/payment`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                ...createWebhookHeaders(
                  body,
                ),
              },
              body,
            },
          );

        expect(
          response.status,
        ).toBe(422);

        expect(
          await response.json(),
        ).toEqual({
          error:
            "Invalid payment webhook payload",
        });

        expect(
          controller.handlePayment,
        ).not.toHaveBeenCalled();
      } finally {
        testServer.close();
      }
    },
  );

  it(
    "rejects a tampered body even with the original signature",
    async () => {
      const controller = {
        handlePayment: vi.fn(),
      };

      const app = createTestApp(
        controller,
        WEBHOOK_SECRET,
      );

      const testServer =
        await startTestServer(app);

      try {
        const originalBody =
          JSON.stringify(
            validStkPayload,
          );

        const tamperedPayload = {
          ...validStkPayload,
          data: {
            ...validStkPayload.data,
            amount: 9999,
          },
        };

        const tamperedBody =
          JSON.stringify(
            tamperedPayload,
          );

        /*
         * The signature belongs to originalBody, but the request
         * contains tamperedBody. Verification must therefore fail.
         */
        const originalHeaders =
          createWebhookHeaders(
            originalBody,
          );

        const response =
          await fetch(
            `${testServer.url}/webhooks/payment`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                "Connection": "close",
                ...originalHeaders,
              },
              body: tamperedBody,
            },
          );

        expect(
          response.status,
        ).toBe(401);

        expect(
          await response.json(),
        ).toEqual({
          error:
            "Invalid webhook signature",
        });

        expect(
          controller.handlePayment,
        ).not.toHaveBeenCalled();
      } finally {
        testServer.close();
      }
    },
  );
});