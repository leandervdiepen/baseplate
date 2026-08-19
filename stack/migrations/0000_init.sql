-- Baseline. Guarded so a volume created before migrations existed adopts it.
-- Later files are generated against the snapshot in meta/ and need no guards.
CREATE TABLE IF NOT EXISTS "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"body" text NOT NULL
);
