# iFarm Academy — STAGE Homologation v0.70

## Consolidation scope

- Baseline: `develop` v0.69.
- Mercado Pago signed webhook ingress and receipt ledger from `feature/mercadopago-webhook-v0.70`.
- PWA manifest foundation from `feature/pwa-foundation-v0.68`, completed with HTML registration and an installable icon.
- Older feature branches were audited as historical or superseded implementations; their current functionality is already represented in the cumulative `develop` line and they must not be merged wholesale over newer contracts.

## Automated acceptance gates

- TypeScript typecheck.
- Vitest unit and Pages Functions contracts.
- Ordered D1 migration validation.
- All offline integration fixtures defined by CI.
- Production Vite build.
- PWA manifest and icon availability.

## STAGE navigation checklist

- Public Academy home and discovery.
- Unified search.
- Public course, path, instructor, plan, partner, bundle and event routes.
- Public certificate validation.
- Authentication boundary and protected workspace entry.
- Student learning, assessment, progress and certificates.
- Instructor/course governance and reports.
- Commercial plans, checkout and payment readiness.

## Environment-dependent checks

The following checks require the exclusive iFarm Academy STAGE resources and repository secrets:

- Cloudflare Pages project `ifarm-academy-stage`.
- Academy-only D1 database and migrations.
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` repository secrets.
- STAGE Neon Auth endpoint already declared by the deployment workflow.
- Mercado Pago webhook secret and provider credentials when external payment homologation is enabled.

Production remains blocked until STAGE is explicitly homologated.
