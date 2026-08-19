The app's tables. One `.sql` file per change, applied once each in filename order.

This directory is `drizzle-kit`'s `out`, so the usual drizzle loop works:
edit `stack/schema.ts`, run `npm run db:generate`, commit the file it writes.
Hand-written SQL in the same format works too, and so does the dashboard's schema editor.

A ledger in `baseplate.migrations` records each file and a checksum.
Editing a file that has already been applied is an error: add a new file instead.

Migrations own table shape only.
Row access comes from `accessPolicies` in `stack/stack.json` and is re-applied after every migration.
A table with no declared policy gets no grants, so PostgREST cannot read it.

Baseplate's own tables are in `stack/platform/` and are applied first.

## Two authors, one directory

`npm run db:generate` diffs `stack/schema.ts` against the snapshot in `meta/`.
`./scripts/schema` and the dashboard write SQL straight into this directory and do not touch that snapshot.
Mixing them leaves drizzle's snapshot behind the database, and its next generate would try to recreate what already exists.

If you use both, run `npm run db:pull` after a dashboard change.
It reads the live database and rewrites `stack/schema.ts` and the snapshot to match.
