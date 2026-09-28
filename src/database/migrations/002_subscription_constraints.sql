CREATE UNIQUE INDEX subscriptions_one_active_per_installation
    ON subscriptions (installation_id)
    WHERE status = 'ACTIVE';