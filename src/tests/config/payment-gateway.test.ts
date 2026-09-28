import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  getBrifNetMpesaGatewayConfig,
} from "../../config/payment-gateway.js";

describe(
  "getBrifNetMpesaGatewayConfig",
  () => {
    const originalEnv = {
      BRIFNET_MPESA_GATEWAY_URL:
        process.env.BRIFNET_MPESA_GATEWAY_URL,

      BRIFNET_MPESA_TIMEOUT_MS:
        process.env.BRIFNET_MPESA_TIMEOUT_MS,

      BRIFNET_MPESA_ACCESS_TOKEN:
        process.env.BRIFNET_MPESA_ACCESS_TOKEN,
    };

    afterEach(() => {
      if (
        originalEnv.BRIFNET_MPESA_GATEWAY_URL ===
        undefined
      ) {
        delete process.env.BRIFNET_MPESA_GATEWAY_URL;
      } else {
        process.env.BRIFNET_MPESA_GATEWAY_URL =
          originalEnv.BRIFNET_MPESA_GATEWAY_URL;
      }

      if (
        originalEnv.BRIFNET_MPESA_TIMEOUT_MS ===
        undefined
      ) {
        delete process.env.BRIFNET_MPESA_TIMEOUT_MS;
      } else {
        process.env.BRIFNET_MPESA_TIMEOUT_MS =
          originalEnv.BRIFNET_MPESA_TIMEOUT_MS;
      }

      if (
        originalEnv.BRIFNET_MPESA_ACCESS_TOKEN ===
        undefined
      ) {
        delete process.env.BRIFNET_MPESA_ACCESS_TOKEN;
      } else {
        process.env.BRIFNET_MPESA_ACCESS_TOKEN =
          originalEnv.BRIFNET_MPESA_ACCESS_TOKEN;
      }
    });

    it(
      "requires the gateway URL",
      () => {
        delete process.env.BRIFNET_MPESA_GATEWAY_URL;

        expect(() =>
          getBrifNetMpesaGatewayConfig(),
        ).toThrow(
          "BRIFNET_MPESA_GATEWAY_URL is required",
        );
      },
    );

    it(
      "uses the default timeout",
      () => {
        process.env.BRIFNET_MPESA_GATEWAY_URL =
          "https://gateway.example.com";

        delete process.env.BRIFNET_MPESA_TIMEOUT_MS;

        const config =
          getBrifNetMpesaGatewayConfig();

        expect(config.timeoutMs).toBe(10_000);
      },
    );

    it(
      "reads a configured timeout",
      () => {
        process.env.BRIFNET_MPESA_GATEWAY_URL =
          "https://gateway.example.com";

        process.env.BRIFNET_MPESA_TIMEOUT_MS =
          "5000";

        const config =
          getBrifNetMpesaGatewayConfig();

        expect(config.timeoutMs).toBe(5000);
      },
    );

    it(
      "rejects an invalid timeout",
      () => {
        process.env.BRIFNET_MPESA_GATEWAY_URL =
          "https://gateway.example.com";

        process.env.BRIFNET_MPESA_TIMEOUT_MS =
          "invalid";

        expect(() =>
          getBrifNetMpesaGatewayConfig(),
        ).toThrow(
          "BRIFNET_MPESA_TIMEOUT_MS must be a positive integer",
        );
      },
    );

    it(
      "rejects a non-positive timeout",
      () => {
        process.env.BRIFNET_MPESA_GATEWAY_URL =
          "https://gateway.example.com";

        process.env.BRIFNET_MPESA_TIMEOUT_MS =
          "0";

        expect(() =>
          getBrifNetMpesaGatewayConfig(),
        ).toThrow(
          "BRIFNET_MPESA_TIMEOUT_MS must be a positive integer",
        );
      },
    );

    it(
      "reads the optional access token",
      () => {
        process.env.BRIFNET_MPESA_GATEWAY_URL =
          "https://gateway.example.com";

        process.env.BRIFNET_MPESA_ACCESS_TOKEN =
          "test-token";

        const config =
          getBrifNetMpesaGatewayConfig();

        expect(config.accessToken).toBe(
          "test-token",
        );
      },
    );
  },
);
