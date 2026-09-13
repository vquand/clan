# Archived database migrations

These files are the original migration history that was applied to the
production Neon database. They are retained as a rollback and audit backup,
but the migration runner does not execute files from this directory.

The active migration path is the squashed baseline in
[`../migrations/001_baseline.sql`](../migrations/001_baseline.sql). Keep this
archive unchanged. Future schema changes should be added as new numbered files
under `db/migrations/`.
