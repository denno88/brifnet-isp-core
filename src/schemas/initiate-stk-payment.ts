import { z } from "zod";

/*
 * STK payment identifies:
 *
 *   installationId → what service is being paid for
 *   phone          → which M-Pesa number receives the STK prompt
 *
 * The phone number does not have to belong to the PPPoE customer.
 */
export const initiateStkPaymentSchema =
  z.object({
    installationId: z.string().uuid(),

    phone: z
      .string()
      .regex(
        /^07\d{8}$/,
        "Phone number must be a valid Kenyan 07XXXXXXXX number",
      ),
  });

export type InitiateStkPaymentRequest =
  z.infer<
    typeof initiateStkPaymentSchema
  >;