# Changelog v0.73.0

## Added
- append-only recurring billing period evidence;
- complete/partial/unavailable evidence states;
- latest billing evidence in subscription administration;
- CI integration fixture for provider-backed period provenance.

## Changed
- confirmed payments no longer require locally constructed period boundaries;
- paid subscriptions can activate with canonical payment/subscription identity while period end remains unknown;
- entitlement access start may use verified payment confirmation time when the provider did not expose period start.

## Removed
- local monthly/annual `period_end` calculation from Mercado Pago webhook.

## Security
- provider resource identity, SHA-256 payload hash and tenant correlation are required for period evidence;
- evidence rows are immutable/append-only;
- historical pre-v0.73 period fields are not promoted retroactively to canonical evidence.
