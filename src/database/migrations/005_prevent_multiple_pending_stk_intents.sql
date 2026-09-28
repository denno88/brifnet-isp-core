CREATE UNIQUE INDEX payment_intents_one_pending_stk_per_installation
ON payment_intents (installation_id)
WHERE channel = 'STK'
  AND status = 'PENDING';