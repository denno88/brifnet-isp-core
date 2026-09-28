import {
  getBrifNetMpesaGatewayConfig,
} from "../../config/payment-gateway.js";

import {
  BrifNetMpesaGateway,
} from "./brifnet-mpesa-gateway.js";

import {
  BrifNetMpesaHttpClient,
} from "./brifnet-mpesa-http-client.js";

export function createBrifNetMpesaGateway(): BrifNetMpesaGateway {
  const config =
    getBrifNetMpesaGatewayConfig();

  const client =
    new BrifNetMpesaHttpClient(config);

  return new BrifNetMpesaGateway(client);
}
