import { z } from "zod";

import type {
  BrifNetMpesaGatewayClient,
} from "./brifnet-mpesa-gateway.js";

const stkResponseSchema = z.object({
  message: z.string(),
  merchant_request_id: z.string().min(1),
  checkout_request_id: z.string().min(1),
});

export interface BrifNetMpesaHttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;

  /*
   * Optional for now.
   *
   * The current gateway does not require an access token on
   * the documented STK endpoint, but this gives us a clean
   * place to add one later without changing the application
   * layer or PaymentProvider contract.
   */
  accessToken?: string;
}

export class BrifNetMpesaHttpClient
  implements BrifNetMpesaGatewayClient
{
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly accessToken?: string;

  constructor(
    options: BrifNetMpesaHttpClientOptions,
  ) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.accessToken = options.accessToken ?? "";
  }

  async initiateStkPayment(
    input: {
      reference: string;
      amount: number;
      phone: string;
    },
  ): Promise<{
    providerReference: string;
    checkoutRequestId: string;
  }> {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      /*
       * Authentication is deliberately isolated here.
       *
       * When the gateway later requires an access token,
       * configuration can enable it without touching the
       * application use case.
       */
      if (this.accessToken) {
        headers.Authorization = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(
        `${this.baseUrl}/wp-json/brifnet/v1/mpesa/stk`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            reference: input.reference,
            phone: input.phone,
            amount: input.amount,
          }),
          signal: controller.signal,
        },
      );

      const body = await this.readJson(response);

      if (!response.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : `Gateway request failed with HTTP ${response.status}`;

        throw new Error(message);
      }

      const parsed =
        stkResponseSchema.safeParse(body);

      if (!parsed.success) {
        throw new Error(
          "Gateway returned an invalid STK response",
        );
      }

      return {
        /*
         * The application calls this providerReference.
         *
         * The actual BrifNet gateway calls it
         * merchant_request_id.
         */
        providerReference:
          parsed.data.merchant_request_id,

        checkoutRequestId:
          parsed.data.checkout_request_id,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readJson(
    response: Response,
  ): Promise<unknown> {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        "Gateway returned invalid JSON",
      );
    }
  }
}
