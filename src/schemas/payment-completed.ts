import { z } from "zod";

/*
 * STK completion event.
 *
 * STK payments originate from a PaymentIntent, so the
 * provider reference is used to correlate the callback
 * with the provider-side request.
 *
 * provider_transaction_id is the actual financial transaction
 * identity and is our database-level idempotency key.
 */
const stkPaymentCompletedSchema = z.object({
  reference: z.string().min(1),

  phone: z
    .string()
    .regex(/^07\d{8}$/),

  amount: z.number().positive(),

  channel: z.literal("STK"),

  provider_reference: z.string().min(1),

  provider_transaction_id: z.string().min(1),
});

/*
 * C2B completion event.
 *
 * C2B does not originate from a PaymentIntent.
 * The customer's account number therefore identifies
 * the installation to which the payment belongs.
 *
 * provider_transaction_id remains the financial idempotency key.
 */
const c2bPaymentCompletedSchema = z.object({
  reference: z.string().min(1),

  account_number: z.string().min(1),

  phone: z
    .string()
    .regex(/^07\d{8}$/),

  amount: z.number().positive(),

  channel: z.literal("C2B"),

  provider_transaction_id: z.string().min(1),
});

/*
 * The webhook event envelope is shared by both payment
 * channels, while the data object is selected according
 * to the channel discriminator.
 */
export const paymentCompletedSchema = z.object({
  event_id: z.string().min(1),

  event: z.literal("payment.completed"),

  occurred_at: z.string().datetime({
    offset: true,
  }),

  data: z.discriminatedUnion("channel", [
    stkPaymentCompletedSchema,
    c2bPaymentCompletedSchema,
  ]),
});

export type PaymentCompletedEvent = z.infer<
  typeof paymentCompletedSchema
>;
