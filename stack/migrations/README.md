Numbered `.sql` files, applied once each, in filename order.

A ledger in `baseplate.migrations` records the name and a checksum.
Editing a file that has already been applied is an error: add a new file instead.

`--> statement-breakpoint` splits a file into statements.
That is drizzle-kit's format, so `npx drizzle-kit generate` can write straight into this directory.

Migrations own table shape only.
Row access comes from `accessPolicies` in `stack/stack.json` and is re-applied after every migration.
