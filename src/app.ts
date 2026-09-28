import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { AppError } from "./errors/app-error.js";

import {
  paymentWebhookController,
  stkPaymentController,
  webhookSecret,
} from "./container.js";

import {
  createPaymentsRouter,
} from "./routes/payments.js";

import {
  createWebhooksRouter,
} from "./routes/webhooks.js";

const app = express();

app.use(
  express.json({
    verify: (req, _res, buffer) => {
      (
        req as Request & {
          rawBody?: Buffer;
        }
      ).rawBody = Buffer.from(buffer);
    },
  }),
);

app.use(
  "/payments",
  createPaymentsRouter(
    stkPaymentController,
  ),
);

app.use(
  "/webhooks",
  createWebhooksRouter(
    paymentWebhookController,
    webhookSecret,
  ),
);

app.get("/", (_req, res) => {
  res.json({
    message: "BrifNet ISP Core API",
  });
});

app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    console.error(err);

    if (err instanceof AppError) {
      return res.status(
        err.statusCode,
      ).json({
        error: err.message,
      });
    }

    res.status(500).json({
      error: "Internal server error",
    });
  },
);

export default app;