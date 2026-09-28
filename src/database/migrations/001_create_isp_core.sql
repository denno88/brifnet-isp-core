CREATE TABLE pppoe_users(
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pppoe_users_status_check
        CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);

CREATE TABLE service_plans (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    download_mbps INTEGER NOT NULL,
    upload_mbps INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_plans_download_check
        CHECK (download_mbps > 0),

    CONSTRAINT service_plans_upload_check
        CHECK (upload_mbps > 0)
);

CREATE TABLE products (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    service_plan_id UUID NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    duration_days INTEGER NOT NULL,
    grace_period_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT products_service_plan_fk
        FOREIGN KEY (service_plan_id)
        REFERENCES service_plans(id),

    CONSTRAINT products_price_check
        CHECK (price >= 0),

    CONSTRAINT products_duration_check
        CHECK (duration_days > 0),

    CONSTRAINT products_grace_period_check
        CHECK (grace_period_days >= 0)
);

CREATE TABLE pppoe_installations (
    id UUID PRIMARY KEY,
    pppoe_user_id UUID NOT NULL,

    account_prefix VARCHAR(20) NOT NULL,
    account_sequence INTEGER NOT NULL,
    account_number VARCHAR(50) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT installations_user_fk
        FOREIGN KEY (pppoe_user_id)
        REFERENCES pppoe_users(id),

    CONSTRAINT installations_status_check
        CHECK (status IN ('PENDING', 'ACTIVE')),

    CONSTRAINT installations_account_sequence_check
        CHECK (account_sequence > 0),

    CONSTRAINT installations_account_number_unique
        UNIQUE (account_number),

    CONSTRAINT installations_prefix_sequence_unique
        UNIQUE (account_prefix, account_sequence)
);

CREATE TABLE pppoe_credentials (
    id UUID PRIMARY KEY,
    installation_id UUID NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT credentials_installation_fk
        FOREIGN KEY (installation_id)
        REFERENCES pppoe_installations(id),

    CONSTRAINT credentials_status_check
        CHECK (status IN ('ACTIVE', 'REVOKED'))
);


CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    installation_id UUID NOT NULL,
    product_id UUID NOT NULL,

    status VARCHAR(20) NOT NULL,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    grace_ends_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT subscriptions_installation_fk
        FOREIGN KEY (installation_id)
        REFERENCES pppoe_installations(id),

    CONSTRAINT subscriptions_product_fk
        FOREIGN KEY (product_id)
        REFERENCES products(id),

    CONSTRAINT subscriptions_status_check
        CHECK (
            status IN (
                'ACTIVE',
                'GRACE',
                'EXPIRED',
                'SUSPENDED'
            )
        ),

    CONSTRAINT subscriptions_period_check
        CHECK (current_period_end > current_period_start)
);

