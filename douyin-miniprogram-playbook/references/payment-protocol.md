# Payment protocol notes

- Use the `trade_basic` flow and compare order amounts with the configured product table.
- For the legacy sign payload described by the platform, sort the field values plus SALT as one value array and concatenate them; do not build a `key=value` string.
- The platform authorization string uses `SHA256-RSA2048 appid=...,nonce_str=...,timestamp=...,key_version=...,signature=...`.
- Cache client tokens for roughly two hours, renew five minutes early, and force-refresh once after a 401.
- Verify callbacks, reject timestamps older than ten minutes, and make settlement idempotent. Because callbacks can be delayed, keep an active order-query fallback.
- Keep PEM keys and salts in the prefixed `platform_secrets` collection, never in environment variables or source control.
- For refunds, first call `order_query` to obtain the `motb...` transaction order id. The `MECPN...` value shown in some console lists is a payment id and cannot be sent as `order_id`.
- Send `item_order_detail` with the returned item order id and refund amount. `refund_reason` is an integer enum (101, 102, 103, or 999), not a string. The endpoint is `refund_query/`, and the response is an accepted request that must be polled or confirmed by callback.
