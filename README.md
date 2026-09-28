# BrifNet ISP Core

TypeScript backend core for managing BrifNet's PPPoE ISP services, customer accounts, installations, subscriptions, payments, and, eventually, network provisioning.

The system is intentionally designed as a **modular monolith** with PostgreSQL as the transactional source of truth.

The primary engineering goals are:

* Strong domain boundaries
* Transactional correctness
* Idempotent payment processing
* Explicit concurrency control
* Testability
* Provider independence
* Operational reliability
* Clear separation between application logic and infrastructure

---

## Status

🚧 **Active development**

The current implementation includes:

* ISP domain model
* PPPoE user management
* Installation lifecycle
* Installation account-number allocation
* PPPoE credential management
* Service plans and commercial products
* Subscription lifecycle
* PostgreSQL repositories
* Transaction management
* Transaction savepoints
* STK payment initiation
* C2B payment completion
* Payment idempotency
* Concurrent payment handling
* BrifNet M-Pesa Gateway integration
* Signed payment-completion webhooks
* External payload validation
* Repository and integration tests
* PostgreSQL concurrency tests

Network provisioning through FreeRADIUS and MikroTik is planned but is **not yet implemented**.

---

# Architecture

The application follows a layered architecture with explicit dependency direction.

```text
                         HTTP
                          │
                          ▼
                ┌──────────────────┐
                │ Routes /         │
                │ Controllers      │
                │ Schemas          │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Application      │
                │ Use Cases        │
                └────────┬─────────┘
                         │
                ┌────────┴─────────┐
                │                  │
                ▼                  ▼
          ┌───────────┐     ┌───────────────┐
          │  Domain   │     │ Application   │
          │           │     │ Ports         │
          └───────────┘     └───────┬───────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │ Infrastructure  │
                           │                 │
                           │ PostgreSQL      │
                           │ M-Pesa Gateway  │
                           │ Account Numbers │
                           │ Credentials     │
                           └─────────────────┘
```

The application layer depends on abstractions rather than concrete external services.

Infrastructure implements those abstractions.

The domain layer does not depend on PostgreSQL, Express, HTTP clients, or external providers.

---

## Example: Payment Provider

STK payment initiation is represented by an application-level `PaymentProvider` port.

```text
InitiateStkPayment
        │
        ▼
PaymentProvider
        ▲
        │
BrifNetMpesaGateway
        │
        ▼
BrifNetMpesaHttpClient
        │
        ▼
BrifNet M-Pesa Gateway
```

The application therefore does not need to know how the external gateway communicates with M-Pesa.

This also makes the payment use case independently testable.

---

# Core Domain

The current domain model is:

```text
PPPoE User
    │
    └── Installation
            │
            ├── PPPoE Credential
            │
            └── Subscription
                    │
                    └── Product
                            │
                            └── Service Plan
```

Payments are associated with installations and subscriptions.

```text
Installation
      │
      ▼
Subscription
      │
      ▼
PaymentIntent
      │
      ▼
M-Pesa STK
      │
      ▼
Payment
```

The core separates:

* Customer/account identity
* Physical service installation
* Network credentials
* Technical service capability
* Commercial products
* Service entitlement
* Financial transactions

---

# Domain Model

## PPPoE User

A `PppoeUser` represents the ISP customer/account entity.

A user may have multiple physical installations.

The customer account is therefore separate from the physical service endpoint.

---

## Installation

An installation represents a physical ISP service endpoint.

An installation begins as:

```text
PENDING
```

and becomes:

```text
ACTIVE
```

after the physical connection has been verified and activated.

Each installation receives its own account number.

Account numbers are allocated using a prefix and sequence.

The allocation model deliberately permits gaps.

Previously allocated account numbers are not reused.

Account-number allocation is protected by database transaction/concurrency controls so concurrent allocations cannot produce duplicate account numbers.

---

## PPPoE Credentials

Credentials belong to an installation.

Credentials are created during installation activation rather than during payment processing.

The same credentials remain associated with the installation across subscription renewals.

Credential generation uses a cryptographically secure random source.

Credentials are never intentionally written to application logs.

---

## Service Plans

A service plan represents the **technical network capability** of a service.

Examples of plan attributes include:

* Download bandwidth
* Upload bandwidth

The service plan is deliberately separate from commercial pricing.

---

## Products

A product represents a **commercial package**.

A product combines:

* Service plan
* Price
* Duration
* Grace period

This allows multiple commercial products to use the same technical service plan while having different durations or prices.

For example, the same 20 Mbps service plan can be sold as different weekly, bi-weekly, or monthly products.

---

## Subscriptions

A subscription represents the customer's commercial entitlement to a service.

Supported states currently include:

```text
ACTIVE
GRACE
EXPIRED
SUSPENDED
```

Only one `ACTIVE` subscription is permitted per installation.

Renewals extend the existing entitlement period rather than simply starting from the payment timestamp.

This means a customer renewing before expiry does not lose their remaining service time.

For example:

```text
Current expiry
      │
      ├──────────── Existing entitlement
      │
      ▼
Renewal duration added
      │
      ▼
New expiry
```

Subscription renewal is protected by PostgreSQL row-level locking when concurrent payment completions target the same subscription.

---

# Payment Architecture

Payment initiation and payment completion are deliberately separate operations.

An STK request being successfully accepted by the gateway does **not** mean that money has been received.

The financial `Payment` record is created only after a trusted payment-completion event has been processed.

There are currently two payment paths:

* STK
* C2B

---

# STK Payments

```text
Installation
      │
      ▼
Subscription
      │
      ▼
Create PaymentIntent
      │
      ▼
BrifNet M-Pesa Gateway
      │
      ▼
Safaricom
      │
      ▼
Payment Completion Webhook
      │
      ▼
CompletePayment
      │
      ├── Create Payment
      ├── Renew Subscription
      └── Complete PaymentIntent
```

A `PaymentIntent` represents an attempt to initiate an STK payment.

The initial state is:

```text
PENDING
```

The current STK intent expiry period is **10 minutes**.

An expired intent is not automatically changed merely because its `expires_at` timestamp has passed.

Background expiry processing is planned.

The application also defensively handles stale pending intents when a new STK payment is initiated.

---

## One Pending STK Intent

The database enforces:

> At most one `PENDING` STK PaymentIntent may exist for an installation.

This is enforced using a PostgreSQL partial unique index.

```sql
CREATE UNIQUE INDEX payment_intents_one_pending_stk_per_installation
ON payment_intents (installation_id)
WHERE channel = 'STK'
  AND status = 'PENDING';
```

This is a deliberate business and concurrency constraint.

It prevents multiple simultaneous STK payment intents from being created for the same installation.

---

# C2B Payments

C2B payments do not require a `PaymentIntent`.

```text
Customer Payment
      │
      ▼
C2B Callback
      │
      ▼
Installation Account Number
      │
      ▼
Product Resolution
      │
      ▼
Payment
      │
      ▼
Subscription Renewal
```

The installation account number identifies the service being paid for.

The product is currently resolved using an **exact payment amount**.

The amount must match exactly one product.

If zero products match, the payment cannot be resolved.

If multiple products match, the payment is rejected rather than being assigned ambiguously.

This makes the current C2B product-resolution rule deterministic.

---

# Payment Phone Numbers

The payer's phone number is treated as payment information, not as the customer's identity.

A customer may therefore pay using a phone number different from the phone number stored on the PPPoE account.

The payment phone number is retained as part of the payment record for payment/audit purposes.

---

# Payment Reliability

Payment processing is designed around database-level correctness.

Current protections include:

* PostgreSQL transactions
* PostgreSQL row-level locking
* Provider transaction uniqueness
* Idempotent payment creation
* Unique payment references
* Conditional PaymentIntent provider-detail updates
* Transaction savepoints
* Subscription locking during renewal
* One pending STK intent per installation
* No database transaction held across external HTTP calls

These mechanisms are intentionally implemented at the database/application boundary rather than relying solely on application-level checks.

---

## Idempotency

Provider transaction IDs are unique in the payments table.

If the same payment-completion event is delivered more than once, the existing payment can be returned instead of creating a duplicate payment.

This also prevents the same payment from renewing a subscription multiple times.

The payment completion workflow therefore treats duplicate provider callbacks as an expected operational condition rather than an exceptional application state.

---

## Concurrency

Critical operations use PostgreSQL row-level locking.

For example, concurrent subscription renewals are serialized:

```text
Payment Completion A
        │
        ▼
Lock Subscription
        │
        ▼
Renew
        │
        ▼
Commit
        │
        ▼
Payment Completion B
        │
        ▼
Lock Subscription
        │
        ▼
Renew
        │
        ▼
Commit
```

This prevents concurrent transactions from reading the same subscription state and subsequently overwriting each other's renewal.

Concurrency behavior is tested against a real PostgreSQL database.

---

## Transaction Boundaries

External HTTP calls are deliberately not performed while holding a PostgreSQL transaction.

For STK initiation, the flow is conceptually:

```text
Database Transaction
        │
        ├── Lock installation
        ├── Validate installation
        ├── Check pending intent
        ├── Create PaymentIntent
        │
        ▼
     COMMIT
        │
        ▼
External M-Pesa Gateway
        │
        ▼
Database Transaction
        │
        └── Attach provider details
```

This prevents a slow or unavailable external service from unnecessarily holding database locks.

---

# M-Pesa Gateway Integration

The core communicates with the existing **BrifNet M-Pesa Gateway**.

The core does not communicate directly with Safaricom.

The current STK gateway endpoint is:

```text
POST /wp-json/brifnet/v1/mpesa/stk
```

The core sends:

```json
{
  "reference": "PAY-ABC123",
  "phone": "0712345678",
  "amount": 349
}
```

A successful gateway response contains provider-specific identifiers such as:

```json
{
  "message": "STK Push initiated.",
  "merchant_request_id": "...",
  "checkout_request_id": "..."
}
```

The infrastructure adapter translates these identifiers into the provider-neutral application contract:

```text
merchant_request_id
        │
        ▼
providerReference

checkout_request_id
        │
        ▼
checkoutRequestId
```

The application therefore does not depend directly on gateway-specific response field names.

---

## Gateway Configuration

The gateway URL is configuration-driven:

```text
BRIFNET_MPESA_GATEWAY_URL
```

Local development can use a Cloudflare Tunnel.

The gateway HTTP client supports an optional access token:

```text
BRIFNET_MPESA_ACCESS_TOKEN
```

This allows gateway authentication to be introduced or enabled without changing the application payment contract.

Gateway requests also use a configurable timeout:

```text
BRIFNET_MPESA_TIMEOUT_MS
```

---

# Payment Webhooks

The M-Pesa Gateway sends payment-completion events back to the ISP core.

The webhook processing pipeline is:

```text
BrifNet M-Pesa Gateway
        │
        ▼
Webhook HTTP Endpoint
        │
        ├── Verify HMAC Signature
        │
        ├── Validate Payload
        │
        ▼
Payment Completion Handler
        │
        ├── CompletePayment
        │
        └── CompleteC2bPayment
```

Webhook payloads are validated using Zod before application processing.

Webhook requests are authenticated using an HMAC signature.

The webhook secret is configured through:

```text
BRIFNET_MPESA_WEBHOOK_SECRET
```

Duplicate webhook delivery is handled through payment idempotency.

---

# Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Then configure PostgreSQL and the BrifNet M-Pesa Gateway.

Current environment variables include:

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME

BRIFNET_MPESA_GATEWAY_URL
BRIFNET_MPESA_TIMEOUT_MS
BRIFNET_MPESA_ACCESS_TOKEN
BRIFNET_MPESA_WEBHOOK_SECRET
```

`.env` contains local configuration and secrets and must never be committed to Git.

The repository includes `.env.example` as the safe template for required configuration.

---

## API Reference

The ISP Core exposes a small HTTP API. Frontend applications interact with the core primarily through the payment initiation endpoint. Payment completion is handled asynchronously through the payment webhook received from the BrifNet M-Pesa Gateway.

### Endpoint summary

| Method | Endpoint            | Consumer                      | Purpose                          |
| ------ | ------------------- | ----------------------------- | -------------------------------- |
| `GET`  | `/`                 | Any client                    | API health/identity response     |
| `POST` | `/payments/stk`     | Frontend / client application | Initiate an STK Push             |
| `POST` | `/webhooks/payment` | BrifNet M-Pesa Gateway        | Receive confirmed payment events |

---

### GET `/`

Returns a simple API identity response.

#### Response

HTTP `200 OK`

```json
{
  "message": "BrifNet ISP Core API"
}
```

---

### POST `/payments/stk`

Initiates an STK Push for an installation.

The frontend does **not** provide the amount or product. The ISP Core determines the renewable subscription and associated product, then creates the payment intent using the product's configured price.

#### Request

```http
POST /payments/stk
Content-Type: application/json
```

```json
{
  "installationId": "7b7e8e8d-7c45-4b0e-a9d7-7c7e0c1d1234",
  "phone": "0712345678"
}
```

#### Request fields

| Field            | Type   | Required | Description                                          |
| ---------------- | ------ | -------: | ---------------------------------------------------- |
| `installationId` | UUID   |      Yes | Installation that the payment is intended for        |
| `phone`          | string |      Yes | M-Pesa phone number that should receive the STK Push |

The payment phone number does **not** have to match the phone number stored on the PPPoE user account.

#### Successful response

HTTP `200 OK`

```json
{
  "payment": {
    "id": "payment-intent-uuid",
    "reference": "PAY-XXXXXX",
    "amount": 349,
    "channel": "STK",
    "status": "PENDING",
    "expiresAt": "2026-09-27T18:30:00.000Z",
    "providerReference": "provider-reference",
    "checkoutRequestId": "ws_CO_XXXXXXXX"
  }
}
```

The actual values are generated by the ISP Core and payment provider.

A `200` response means the STK payment initiation succeeded. It does **not** mean that the customer has completed payment.

The expected lifecycle is:

```text
Frontend
   │
   │ POST /payments/stk
   ▼
ISP Core
   │
   │ Create PaymentIntent
   │ Initiate STK Push
   ▼
M-Pesa Gateway
   │
   │ Customer completes payment
   ▼
M-Pesa
   │
   │ payment.completed
   ▼
BrifNet M-Pesa Gateway
   │
   │ POST /webhooks/payment
   ▼
ISP Core
   │
   │ Complete payment
   │ Renew subscription
   ▼
ACTIVE subscription
```

The frontend should therefore treat the returned payment as **PENDING** until the application's payment/subscription state confirms completion.

#### Validation error

The request body is validated before the controller is called.

Invalid input returns HTTP `422`.

Example request:

```json
{
  "installationId": "invalid",
  "phone": "123"
}
```

Response:

```json
{
  "error": "Invalid STK payment request"
}
```

---

### POST `/webhooks/payment`

Receives confirmed payment events from the BrifNet M-Pesa Gateway.

This is an **integration endpoint**, not a frontend endpoint.

```http
POST /webhooks/payment
Content-Type: application/json
```

The request must contain the valid webhook signature expected by the configured webhook-signature middleware.

The application captures the raw request body before JSON parsing so that the signature can be verified against the original payload.

The payload is then validated against `paymentCompletedSchema`.

#### STK completion

For an STK payment, the webhook contains the payment reference originally created by the ISP Core.

Conceptually:

```json
{
  "event_id": "evt-123",
  "event": "payment.completed",
  "occurred_at": "2026-09-27T18:25:00.000Z",
  "data": {
    "reference": "PAY-XXXXXX",
    "phone": "0712345678",
    "amount": 349,
    "channel": "STK",
    "provider_reference": "provider-reference",
    "provider_transaction_id": "ABC123XYZ"
  }
}
```

The ISP Core uses the internal payment reference to locate the corresponding `PaymentIntent`.

It then:

1. Validates the payment against the intent.
2. Correlates the payment with the installation and subscription.
3. Creates the financial `Payment` record.
4. Renews the subscription.
5. Marks the `PaymentIntent` as completed.

The operation is idempotent using the provider transaction ID. A repeated webhook for the same provider transaction does not create a second payment.

#### C2B completion

C2B payments do not use a `PaymentIntent`.

The webhook identifies the installation using its account number and resolves the product from the exact payment amount.

Conceptually:

```json
{
  "event_id": "evt-456",
  "event": "payment.completed",
  "occurred_at": "2026-09-27T18:25:00.000Z",
  "data": {
    "account_number": "KAM100",
    "phone": "0712345678",
    "amount": 349,
    "channel": "C2B",
    "provider_transaction_id": "ABC123XYZ"
  }
}
```

The core uses:

```text
account number → installation
amount         → product
```

C2B payments are also idempotent using the provider transaction ID.

#### Successful response

HTTP `200 OK`

```json
{
  "received": true,
  "payment": {
    "id": "payment-uuid",
    "reference": "PAY-XXXXXX",
    "status": "COMPLETED"
  }
}
```

#### Validation error

Invalid webhook payloads return HTTP `422`.

```json
{
  "error": "Invalid payment webhook payload"
}
```

Invalid webhook signatures are rejected by the signature middleware before the webhook reaches the controller.

---

## Error Responses

The API currently uses a simple JSON error format.

### Application errors

Known application errors are returned using their configured HTTP status code:

```json
{
  "error": "Error message"
}
```

For example, invalid STK request data returns:

```http
422 Unprocessable Entity
```

```json
{
  "error": "Invalid STK payment request"
}
```

### Unexpected errors

Unexpected errors are not exposed to the client.

They return:

```http
500 Internal Server Error
```

```json
{
  "error": "Internal server error"
}
```

The server logs the underlying error while returning the generic message to the client.

---

## Frontend Payment Flow

A frontend application should treat **payment initiation** and **payment completion** as separate operations.

### 1. Customer selects Pay

The frontend sends:

```http
POST /payments/stk
```

```json
{
  "installationId": "<installation-id>",
  "phone": "0712345678"
}
```

### 2. Core returns the payment intent

The frontend receives a payment with:

```json
{
  "status": "PENDING"
}
```

The UI should tell the customer that an STK Push has been sent and ask them to complete the payment on their phone.

### 3. Customer completes the M-Pesa payment

The payment gateway receives the provider confirmation and sends a signed:

```http
POST /webhooks/payment
```

request to the ISP Core.

The frontend does **not** call this endpoint.

### 4. Core completes the payment

The ISP Core creates the financial payment and renews the subscription.

The frontend can then use customer-facing read endpoints to display the updated subscription/payment state as those endpoints are introduced.

---

## API Boundary

The frontend should **not**:

* calculate the payment amount;
* choose the product price;
* create `Payment` records directly;
* mark payments as completed;
* call `/webhooks/payment`;
* provide provider transaction IDs;
* determine subscription expiry dates;
* directly modify subscription status.

The frontend initiates the payment request.

The payment gateway confirms the financial transaction.

The ISP Core owns the resulting payment and subscription state.


# Project Structure

```text
src/
├── application/
│   ├── credentials/
│   ├── installations/
│   ├── payments/
│   ├── pppoe-users/
│   ├── ports/
│   └── subscriptions/
│
├── config/
│
├── controllers/
│
├── database/
│   ├── migrate.ts
│   └── migrations/
│
├── domain/
│
├── errors/
│
├── infrastructure/
│   ├── account-numbers/
│   ├── credentials/
│   ├── database/
│   └── payments/
│
├── middleware/
│
├── repositories/
│
├── routes/
│
├── schemas/
│
├── security/
│
├── tests/
│   ├── application/
│   ├── config/
│   ├── database/
│   ├── domain/
│   ├── infrastructure/
│   ├── integration/
│   ├── repositories/
│   ├── routes/
│   └── security/
│
├── app.ts
├── container.ts
└── server.ts
```

### Layer responsibilities

**Domain**

Contains business entities and domain rules.

**Application**

Contains business use cases and application-level ports.

**Repositories**

Contain PostgreSQL implementations of application repository ports.

**Infrastructure**

Contains technical implementations such as:

* PostgreSQL transaction management
* M-Pesa gateway integration
* Account-number allocation
* Credential generation

**Controllers**

Translate validated HTTP requests into application use-case calls and HTTP responses.

**Routes**

Define HTTP endpoints and connect them to controllers/middleware.

**Schemas**

Define and validate external HTTP payloads.

**Middleware**

Handles HTTP concerns such as webhook authentication.

**Security**

Contains reusable security-related primitives such as webhook signature verification.

**Tests**

Tests are organized according to the boundary being tested rather than simply mirroring source files.

---

# Database

PostgreSQL is the transactional source of truth.

Database changes are represented as ordered SQL migrations.

Current migrations cover:

```text
001  ISP core schema
002  Subscription constraints
003  Payment intents
004  Payments
005  Pending STK intent constraint
```

Migrations are executed using:

```bash
npm run migrate
```

The database contains constraints and indexes that enforce important business invariants.

Where correctness depends on concurrency, the database is treated as part of the application design rather than merely as persistence storage.

---

# Development

Install dependencies:

```bash
npm install
```

Run database migrations:

```bash
npm run migrate
```

Run the test suite:

```bash
npm test
```

Build the application:

```bash
npm run build
```

The project should build successfully and the test suite should pass before changes are committed.

---

# Testing Philosophy

Tests verify both business behavior and infrastructure correctness.

Particular attention is given to:

* Domain rules
* Application use cases
* Transaction boundaries
* Race conditions
* Idempotency
* PostgreSQL row locking
* Concurrent payments
* Duplicate callbacks
* External service failures
* Subscription renewal correctness
* Malformed external responses
* Repository behavior
* HTTP routes
* Security primitives
* Configuration behavior

The goal is not simply high test coverage.

Tests are used to make important business and concurrency guarantees executable.

---

## Unit Tests

Domain and application tests verify business behavior without requiring unnecessary infrastructure.

Examples include:

* Subscription lifecycle
* Installation activation
* Credential creation
* Payment completion
* STK initiation
* C2B payment processing

---

## Integration Tests

Integration tests use a real PostgreSQL database where behavior depends on actual database semantics.

This is particularly important for:

* Transactions
* Row-level locks
* Unique constraints
* Concurrent payment processing
* Idempotency
* Subscription renewal races

Database concurrency behavior is therefore not treated as something that can be fully verified with mocks.

---

# Design Direction

The project intentionally starts as a **modular monolith**.

The current priority is:

* Correctness
* Clear domain boundaries
* Transactional integrity
* Idempotency
* Concurrency safety
* Testability
* Observability
* Operational reliability

The system is not being split into microservices prematurely.

Distributed infrastructure will only be introduced where it provides a concrete engineering benefit.

The goal is to make the modular boundaries strong enough that components can be extracted later if there is a real operational or scaling reason to do so.

---

# Technology

## Current

* Node.js
* TypeScript
* Express
* PostgreSQL
* `pg`
* Zod
* Vitest
* Supertest

## Planned

* Redis
* BullMQ
* Docker
* GitHub Actions
* Structured logging
* Metrics
* Distributed tracing
* FreeRADIUS integration
* MikroTik integration

Planned components are not currently required by the core application.

---

# Roadmap

The next engineering stages are:

1. Repository and Git hygiene
2. Configuration hardening
3. Final architecture review
4. Structured logging
5. Request/correlation IDs
6. Centralized error handling
7. Health and readiness endpoints
8. Graceful application shutdown
9. GitHub Actions CI
10. Dockerized development environment
11. Background payment-intent expiry
12. Redis/BullMQ where background processing requires it
13. FreeRADIUS integration
14. MikroTik/network provisioning
15. Operational metrics and distributed tracing

The roadmap is intentionally incremental. Infrastructure will be introduced when the application has a concrete requirement for it.

---

# Engineering Principles

The project follows several principles:

### Business logic belongs in application/domain layers

Infrastructure should implement technical concerns rather than contain core business decisions.

### Database constraints are part of correctness

Important invariants should be enforced by PostgreSQL where appropriate rather than relying entirely on application checks.

### Transactions should be short

Database transactions should protect atomic state changes without unnecessarily spanning external network calls.

### External providers are adapters

Payment providers should be replaceable without rewriting payment business logic.

### Idempotency is expected

Payment callbacks and external events may be delivered more than once.

The system must therefore make repeated processing safe.

### Concurrency must be designed explicitly

Correct behavior under concurrent requests is part of the application contract, not an optimization to be added later.

### Tests should prove important guarantees

Especially where behavior depends on PostgreSQL transactions, constraints, or row locking, tests should exercise the real infrastructure.

---

# License

Private / proprietary — BrifNet Technologies Ltd.
