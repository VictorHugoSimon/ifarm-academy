# Changelog — v0.46.0

## Added

- iFarm Core API v1 identity adapter.
- Neon Auth client shared with the Core architecture.
- Shared authenticated fetch for protected Academy APIs.
- Core identity middleware with client header stripping.
- Core context diagnostic endpoint.
- Core role/permission/MFA information in Academy trusted context.
- Core integration status in Operations/readiness.
- Contract tests for Core identity and forged header rejection.
- Architecture document `CORE-INTEGRATION-v0.46.md`.

## Changed

- `TrustedContext` now carries permissions, Core role, MFA state and identity source.
- Academy version raised to 0.46.0.
- Readiness exposes `identityMode` and whether Core identity is configured.

## Security

- When Core mode is enabled, browser-supplied internal `x-ifarm-*` identity headers are stripped before request processing.
- Tenant comes from the identity confirmed by iFarm Core, not from a browser header.
- Privileged Academy role projection requires MFA satisfied by the Core.
- Core access token is forwarded only to Core and is never persisted or returned by diagnostics.

## Compatibility

- Legacy proxy boundary remains available only when `ACADEMY_CORE_API_URL` is absent, preserving DEV/tests during migration.
- No database migration is required in v0.46.
