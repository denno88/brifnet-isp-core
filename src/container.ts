import {
  CompleteC2bPayment,
} from "./application/payments/complete-c2b-payment.js";

import {
  CompletePayment,
} from "./application/payments/complete-payment.js";

import {
  InitiateStkPayment,
} from "./application/payments/initiate-stk-payment.js";

import {
  PaymentWebhookController,
} from "./controllers/payment-webhook-controller.js";

import {
  StkPaymentController,
} from "./controllers/stk-payment-controller.js";

import {
  PostgresTransactionManager,
} from "./infrastructure/database/postgres-transaction-manager.js";

import {
  BrifNetMpesaGateway,
} from "./infrastructure/payments/brifnet-mpesa-gateway.js";

import {
  BrifNetMpesaHttpClient,
} from "./infrastructure/payments/brifnet-mpesa-http-client.js";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured`,
    );
  }

  return value;
}

const webhookSecret = requireEnv(
  "BRIFNET_MPESA_WEBHOOK_SECRET",
);

const gatewayUrl = requireEnv(
  "BRIFNET_MPESA_GATEWAY_URL",
);

const transactionManager =
  new PostgresTransactionManager();

const gatewayClientOptions: {
  baseUrl: string;
  timeoutMs: number;
  accessToken?: string;
} = {
  baseUrl: gatewayUrl,
  timeoutMs: Number(
    process.env.BRIFNET_MPESA_TIMEOUT_MS ??
      10_000,
  ),
};

/*
 * With exactOptionalPropertyTypes enabled, an optional property
 * means "property may be absent", not "property may be undefined".
 *
 * Therefore we only add accessToken when it actually exists.
 */
const accessToken =
  process.env.BRIFNET_MPESA_ACCESS_TOKEN;

if (accessToken) {
  gatewayClientOptions.accessToken =
    accessToken;
}

const gatewayClient =
  new BrifNetMpesaHttpClient(
    gatewayClientOptions,
  );

const paymentProvider =
  new BrifNetMpesaGateway(
    gatewayClient,
  );

const completePayment =
  new CompletePayment(
    transactionManager,
  );

const completeC2bPayment =
  new CompleteC2bPayment(
    transactionManager,
  );

const initiateStkPayment =
  new InitiateStkPayment(
    transactionManager,
    paymentProvider,
  );

export const paymentWebhookController =
  new PaymentWebhookController(
    completePayment,
    completeC2bPayment,
  );

export const stkPaymentController =
  new StkPaymentController(
    initiateStkPayment,
  );

export {
  webhookSecret,
};