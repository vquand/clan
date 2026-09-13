# ADR-001: Squash the production database migration chain

## Status

Accepted

## Date

2026-09-14

## Context

The production Neon database has already received the original 15 migrations.
Keeping the full chain in the active migration directory makes the current
schema harder to inspect, while replaying the historical data backfills is not
appropriate for a new baseline.

## Decision

Use one active `001_baseline.sql` migration containing the final relational
schema. Move the original migration files to `db/migrations-archive/` and keep
them unchanged as the rollback and audit backup.

The migration runner checks whether the current production schema is already
complete. If it is, the runner records the new baseline in `schema_migrations`
without executing the baseline SQL. An empty database executes the baseline
normally. Data loading remains a separate `db:seed` operation.

## Consequences

- Production startup remains safe because historical `ALTER`, `RENAME`, and
  backfill statements are not replayed.
- A fresh database can still be bootstrapped from the repository and seeded
  separately.
- The original migration history remains available for audit and retreat.
- Future schema changes must be added as new numbered migrations and should be
  tested before deployment.
