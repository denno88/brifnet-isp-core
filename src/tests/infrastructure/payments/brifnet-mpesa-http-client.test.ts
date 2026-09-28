import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  BrifNetMpesaHttpClient,
} from "../../../infrastructure/payments/brifnet-mpesa-http-client.js";

describe(
  "BrifNetMpesaHttpClient",
  () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it(
      "sends the correct STK request and maps the gateway response",
      async () => {
        const fetchMock = vi
          .spyOn(globalThis, "fetch")
          .mockResolvedValue(
            new Response(
              JSON.stringify({
                message:
                  "STK Push initiated.",
                merchant_request_id:
                  "merchant-123",
                checkout_request_id:
                  "checkout-123",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            ),
          );

        const client =
          new BrifNetMpesaHttpClient({
            baseUrl:
              "https://example.trycloudflare.com/",
          });

        const result =
          await client.initiateStkPayment({
            reference:
              "PAY-ABC123",

            amount: 349,

            phone:
              "0712345678",
          });

        expect(result).toEqual({
          providerReference:
            "merchant-123",

          checkoutRequestId:
            "checkout-123",
        });

        expect(fetchMock).toHaveBeenCalledWith(
          "https://example.trycloudflare.com/wp-json/brifnet/v1/mpesa/stk",
          expect.objectContaining({
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              reference:
                "PAY-ABC123",

              phone:
                "0712345678",

              amount: 349,
            }),
          }),
        );
      },
    );

    it(
      "rejects a non-success gateway response",
      async () => {
        vi.spyOn(
          globalThis,
          "fetch",
        ).mockResolvedValue(
          new Response(
            JSON.stringify({
              message:
                "M-Pesa rejected the STK Push.",
              error:
                "Request rejected",
            }),
            {
              status: 502,
              headers: {
                "Content-Type":
                  "application/json",
              },
            },
          ),
        );

        const client =
          new BrifNetMpesaHttpClient({
            baseUrl:
              "https://example.trycloudflare.com",
          });

        await expect(
          client.initiateStkPayment({
            reference:
              "PAY-ABC123",

            amount: 349,

            phone:
              "0712345678",
          }),
        ).rejects.toThrow(
          "M-Pesa rejected the STK Push.",
        );
      },
    );

    it(
      "rejects an invalid successful response",
      async () => {
        vi.spyOn(
          globalThis,
          "fetch",
        ).mockResolvedValue(
          new Response(
            JSON.stringify({
              message:
                "STK Push initiated.",
            }),
            {
              status: 200,
              headers: {
                "Content-Type":
                  "application/json",
              },
            },
          ),
        );

        const client =
          new BrifNetMpesaHttpClient({
            baseUrl:
              "https://example.trycloudflare.com",
          });

        await expect(
          client.initiateStkPayment({
            reference:
              "PAY-ABC123",

            amount: 349,

            phone:
              "0712345678",
          }),
        ).rejects.toThrow(
          "Gateway returned an invalid STK response",
        );
      },
    );

    it(
      "adds an access token when configured",
      async () => {
        const fetchMock = vi
          .spyOn(globalThis, "fetch")
          .mockResolvedValue(
            new Response(
              JSON.stringify({
                message:
                  "STK Push initiated.",

                merchant_request_id:
                  "merchant-123",

                checkout_request_id:
                  "checkout-123",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            ),
          );

        const client =
          new BrifNetMpesaHttpClient({
            baseUrl:
              "https://example.trycloudflare.com",

            accessToken:
              "test-access-token",
          });

        await client.initiateStkPayment({
          reference:
            "PAY-ABC123",

          amount: 349,

          phone:
            "0712345678",
        });

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "https://example.trycloudflare.com/wp-json/brifnet/v1/mpesa/stk",
          expect.objectContaining({
            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",

              Authorization:
                "Bearer test-access-token",
            },
          }),
        );
      },
    );

    it(
      "rejects malformed JSON from the gateway",
      async () => {
        vi.spyOn(
          globalThis,
          "fetch",
        ).mockResolvedValue(
          new Response(
            "this is not json",
            {
              status: 200,
            },
          ),
        );

        const client =
          new BrifNetMpesaHttpClient({
            baseUrl:
              "https://example.trycloudflare.com",
          });

        await expect(
          client.initiateStkPayment({
            reference:
              "PAY-ABC123",

            amount: 349,

            phone:
              "0712345678",
          }),
        ).rejects.toThrow(
          "Gateway returned invalid JSON",
        );
      },
    );
  },
);
