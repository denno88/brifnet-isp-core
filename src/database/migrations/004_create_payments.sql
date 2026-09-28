CREATE TABLE payments (
    id UUID PRIMARY KEY,

    installation_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    product_id UUID NOT NULL,

    payment_intent_id UUID,

    reference VARCHAR(100) NOT NULL,

    amount NUMERIC(12, 2) NOT NULL,
    phone VARCHAR(20) NOT NULL,

    channel VARCHAR(10) NOT NULL,

    provider_reference VARCHAR(150),

    provider_transaction_id VARCHAR(150) NOT NULL,

    status VARCHAR(20) NOT NULL,

    received_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT payments_installation_fk
        FOREIGN KEY (installation_id)
        REFERENCES pppoe_installations(id),

    CONSTRAINT payments_subscription_fk
        FOREIGN KEY (subscription_id)
        REFERENCES subscriptions(id),

    CONSTRAINT payments_product_fk
        FOREIGN KEY (product_id)
        REFERENCES products(id),

    CONSTRAINT payments_payment_intent_fk
        FOREIGN KEY (payment_intent_id)
        REFERENCES payment_intents(id),

    CONSTRAINT payments_reference_unique
        UNIQUE (reference),

    CONSTRAINT payments_provider_transaction_unique
        UNIQUE (provider_transaction_id),

    CONSTRAINT payments_channel_check
        CHECK (
            channel IN ('STK', 'C2B')
        ),

    CONSTRAINT payments_status_check
        CHECK (
            status IN (
                'COMPLETED',
                'REVERSED'
            )
        ),

    CONSTRAINT payments_amount_check
        CHECK (amount > 0)
);

CREATE INDEX payments_installation_idx
ON payments (installation_id);

CREATE INDEX payments_subscription_idx
ON payments (subscription_id);

CREATE INDEX payments_payment_intent_idx
ON payments (payment_intent_id);

CREATE INDEX payments_received_at_idx
ON payments (received_at);