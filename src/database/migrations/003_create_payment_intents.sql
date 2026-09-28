CREATE TABLE payment_intents (
    id UUID PRIMARY KEY,

    installation_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    product_id UUID NOT NULL,

    reference VARCHAR(100) NOT NULL,

    amount NUMERIC(12, 2) NOT NULL,
    phone VARCHAR(20) NOT NULL,

    channel VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,

    expires_at TIMESTAMPTZ,

    provider_reference VARCHAR(150),
    checkout_request_id VARCHAR(150),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT payment_intents_installation_fk
        FOREIGN KEY (installation_id)
        REFERENCES pppoe_installations(id),

    CONSTRAINT payment_intents_subscription_fk
        FOREIGN KEY (subscription_id)
        REFERENCES subscriptions(id),

    CONSTRAINT payment_intents_product_fk
        FOREIGN KEY (product_id)
        REFERENCES products(id),

    CONSTRAINT payment_intents_reference_unique
        UNIQUE (reference),

    CONSTRAINT payment_intents_channel_check
        CHECK (channel IN ('STK', 'C2B')),

    CONSTRAINT payment_intents_status_check
        CHECK (
            status IN (
                'PENDING',
                'COMPLETED',
                'FAILED',
                'EXPIRED',
                'CANCELLED'
            )
        ),

    CONSTRAINT payment_intents_amount_check
        CHECK (amount >= 0)
);

CREATE UNIQUE INDEX payment_intents_checkout_request_unique
ON payment_intents (checkout_request_id)
WHERE checkout_request_id IS NOT NULL;

CREATE INDEX payment_intents_installation_idx
ON payment_intents (installation_id);

CREATE INDEX payment_intents_subscription_idx
ON payment_intents (subscription_id);

CREATE INDEX payment_intents_provider_reference_idx
ON payment_intents (provider_reference);