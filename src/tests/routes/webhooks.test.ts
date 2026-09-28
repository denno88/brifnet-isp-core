import { createHmac } from "node:crypto";
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

function createSignature(
  body: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(Buffer.from(body))
    .digest("hex");
}

function createTestApp(
  controller: {
    handlePayment: ReturnType<typeof vi.fn>;
  },
  secret: string,
) {
  const app = express();

  /*
   * Webhook signatures are calculated from the exact bytes
   * sent by the gateway.
   *
   * Capture those bytes before Express parses the JSON.
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
   * unref() prevents this test server from keeping the
   * Node/Vitest process alive after the test finishes.
   */
  server.unref();

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();

    throw new Error(
      "Test server did not expose a TCP address",
    );
  }

  const { port } = address;

  return {
    url: `http://127.0.0.1:${port}`,

    close: () => {
      /*
       * We have already received and asserted the HTTP response.
       * There is no reason for the test to wait for keep-alive
       * sockets to disappear.
       */
      server.closeAllConnections();
      server.close();
    },
  };
}

describe("POST /webhooks/payment", () => {
  const secret = "test-webhook-secret";

  const validStkPayload = {
    event_id: "evt-001",
    event: "payment.completed",
    occurred_at: "2026-09-28T10:00:00+03:00",
    data: {
      reference: "PAY-001",
      phone: "0729633304",
      amount: 100,
      channel: "STK",
      provider_reference: "MERCHANT-001",
      provider_transaction_id: "MPESA-001",
    },
  };

  it("accepts a valid signature and valid payload", async () => {
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
        secret,
    );

    const testServer =
        await startTestServer(app);

    try {
        const body =
        JSON.stringify(validStkPayload);

        console.log("1. Sending webhook request");

        const response = await fetch(
        `${testServer.url}/webhooks/payment`,
        {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            "Connection": "close",
            "X-Webhook-Signature":
                createSignature(body, secret),
            },
            body,
            signal: AbortSignal.timeout(2_000),
        },
        );

        console.log(
        "2. Received response:",
        response.status,
        );

        expect(response.status).toBe(200);

        const responseBody =
        await response.json();

        console.log(
        "3. Received response body:",
        responseBody,
        );

        expect(responseBody).toEqual({
        received: true,
        payment: {
            id: "payment-001",
            reference: "PAY-001",
            status: "COMPLETED",
        },
        });

        console.log(
        "4. Controller calls:",
        controller.handlePayment.mock.calls,
        );

        expect(
        controller.handlePayment,
        ).toHaveBeenCalledOnce();

        console.log("5. Test assertions complete");
    } finally {
        testServer.close();
    }
    });

  it("rejects an invalid signature with 401", async () => {
    const controller = {
      handlePayment: vi.fn(),
    };

    const app = createTestApp(
      controller,
      secret,
    );

    const testServer =
      await startTestServer(app);

    try {
      const body =
        JSON.stringify(validStkPayload);

      const response = await fetch(
        `${testServer.url}/webhooks/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature":
              "invalid-signature",
          },
          body,
        },
      );

      expect(response.status).toBe(401);

      expect(await response.json()).toEqual({
        error: "Invalid webhook signature",
      });

      expect(
        controller.handlePayment,
      ).not.toHaveBeenCalled();
    } finally {
      testServer.close();
    }
  });

  it("rejects a missing signature with 401", async () => {
    const controller = {
      handlePayment: vi.fn(),
    };

    const app = createTestApp(
      controller,
      secret,
    );

    const testServer =
      await startTestServer(app);

    try {
      const body =
        JSON.stringify(validStkPayload);

      const response = await fetch(
        `${testServer.url}/webhooks/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Connection": "close",
          },
          body,
        },
      );

      expect(response.status).toBe(401);

      expect(await response.json()).toEqual({
        error: "Invalid webhook signature",
      });

      expect(
        controller.handlePayment,
      ).not.toHaveBeenCalled();
    } finally {
      testServer.close();
    }
  });

  it("rejects an invalid payload with 422 after signature verification", async () => {
    const controller = {
      handlePayment: vi.fn(),
    };

    const app = createTestApp(
      controller,
      secret,
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
        JSON.stringify(invalidPayload);

      const response = await fetch(
        `${testServer.url}/webhooks/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature":
              createSignature(body, secret),
          },
          body,
        },
      );

      expect(response.status).toBe(422);

      expect(await response.json()).toEqual({
        error: "Invalid payment webhook payload",
      });

      expect(
        controller.handlePayment,
      ).not.toHaveBeenCalled();
    } finally {
      testServer.close();
    }
  });

  it("rejects a tampered body even with the original signature", async () => {
    const controller = {
      handlePayment: vi.fn(),
    };

    const app = createTestApp(
      controller,
      secret,
    );

    const testServer =
      await startTestServer(app);

    try {
      const originalBody =
        JSON.stringify(validStkPayload);

      const tamperedPayload = {
        ...validStkPayload,
        data: {
          ...validStkPayload.data,
          amount: 9999,
        },
      };

      const tamperedBody =
        JSON.stringify(tamperedPayload);

      const response = await fetch(
        `${testServer.url}/webhooks/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Connection": "close",
            "X-Webhook-Signature":
                createSignature(
                originalBody,
                secret,
                ),
          },
          body: tamperedBody,
        },
      );

      expect(response.status).toBe(401);

      expect(await response.json()).toEqual({
        error: "Invalid webhook signature",
      });

      expect(
        controller.handlePayment,
      ).not.toHaveBeenCalled();
    } finally {
      testServer.close();
    }
  });
});