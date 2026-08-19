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
