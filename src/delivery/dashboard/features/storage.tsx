import { useEffect, useState } from "react";
import {
  createBucket,
  dropBucket,
  getBuckets,
  setBucketVisibility,
  type BucketSummary,
} from "../lib/api/index.ts";
import { formatBytes } from "../lib/format.ts";
import { BucketObjects } from "./bucket-objects.tsx";
import { ConfirmInline } from "../patterns/confirm-inline.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Card } from "../primitives/card.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";
import { IconStorage } from "../primitives/icon.tsx";
import { Segmented } from "../primitives/segmented.tsx";

const VISIBILITIES: { id: "private" | "public"; label: string }[] = [
  { id: "private", label: "Private" },
  { id: "public", label: "Public" },
];

export function StoragePage({ apiUp }: { apiUp: boolean }) {
  const [buckets, setBuckets] = useState<BucketSummary[] | null>(null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setBuckets((await getBuckets()).buckets);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read your buckets.");
      setBuckets([]);
    }
  }

  async function act(run: () => Promise<{ buckets: BucketSummary[] }>, said: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setBuckets((await run()).buckets);
      setMessage(said);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  const make = () => {
    const wanted = name.trim();
    if (!wanted) {
      setError("Give the bucket a name.");
      return;
    }
    void act(async () => {
      const next = await createBucket(wanted, visibility);
      setName("");
      return next;
    }, `Made '${wanted}'.`);
  };

  return (
    <>
      <PageHeader
        title="Storage"
        description="Buckets hold files. A caller sees only the objects they put there, decided by the same row-level security that decides your rows."
      />
      <StatusMessage message={message} className="mb-4 block" />
      <StatusMessage message={error} tone="error" className="mb-4 block" />

      <div className="max-w-[var(--container-content)] space-y-[var(--space-md)]">
        <Card className="p-[var(--space-lg)]">
          <form
            className="flex flex-wrap items-end gap-[var(--space-md)]"
            onSubmit={(event) => {
              event.preventDefault();
              make();
            }}
          >
            <div className="min-w-[16rem] flex-1">
              <Field label="New bucket" hint="Lowercase letters, digits, and dashes.">
                <Input
                  value={name}
                  placeholder="avatars"
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
            </div>
            {/* Not a Field: a radio group labels itself, and a second <label>
                pointing at nothing in particular would label nothing. */}
            <div className="flex flex-col gap-[var(--space-sm)]">
              <span
                className="block text-[length:var(--text-sm)] font-medium leading-[var(--leading-chip)]"
              >
                Who can read it
              </span>
              <Segmented
                label="Who can read this bucket"
                options={VISIBILITIES}
                value={visibility}
                onChange={setVisibility}
                className="w-[220px]"
              />
            </div>
            <Button type="submit" busy={busy}>
              Create a bucket
            </Button>
          </form>
          <div className="mt-[var(--space-md)]">
            <Hint>
              {visibility === "public"
                ? "Anyone signed in can read every object in a public bucket. Only whoever put one there can replace or remove it."
                : "Each caller sees only their own objects, and nobody else's, even knowing the key."}
            </Hint>
          </div>
        </Card>

        {buckets && buckets.length === 0 ? (
          <EmptyState
            icon={<IconStorage width={20} height={20} />}
            title="No buckets yet"
            description="A bucket is where an app puts files. Name one above and it is ready to take objects immediately."
          />
        ) : null}

        {(buckets ?? []).map((bucket) => (
          <Card key={bucket.name} className="p-[var(--space-lg)]">
            <div className="flex flex-wrap items-center gap-[var(--space-md)]">
              <div className="min-w-[10rem] flex-1">
                <h3 className="truncate font-mono text-[length:var(--text-lg)] font-semibold">
                  {bucket.name}
                </h3>
                <p className="mt-0.5 text-[length:var(--text-sm)] text-[var(--color-text-muted)] tabular-nums">
                  {bucket.objects} object{bucket.objects === 1 ? "" : "s"},{" "}
                  {formatBytes(bucket.bytes)}
                </p>
              </div>
              <Segmented
                className="w-[220px]"
                label={`Who can read ${bucket.name}`}
                options={VISIBILITIES}
                value={bucket.visibility}
                onChange={(next) =>
                  void act(
                    () => setBucketVisibility(bucket.name, next),
                    `'${bucket.name}' is now ${next}.`,
                  )
                }
              />
              <Button
                variant="secondary"
                className="w-[8.5rem]"
                aria-expanded={open === bucket.name}
                aria-controls={`objects-${bucket.name}`}
                onClick={() => setOpen(open === bucket.name ? null : bucket.name)}
              >
                {open === bucket.name ? "Hide objects" : "Show objects"}
              </Button>
              <DropBucket
                bucket={bucket}
                onDrop={() =>
                  void act(async () => {
                    const next = await dropBucket(bucket.name);
                    setOpen(null);
                    return next;
                  }, `Removed '${bucket.name}'.`)
                }
              />
            </div>

            {open === bucket.name ? (
              <div id={`objects-${bucket.name}`} className="reveal">
                <BucketObjects bucket={bucket.name} apiUp={apiUp} />
              </div>
            ) : null}

          </Card>
        ))}
      </div>
    </>
  );
}

function DropBucket({ bucket, onDrop }: { bucket: BucketSummary; onDrop: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      {/* Kept in place while the question is open, so the row does not reflow
          around the answer. */}
      <Button
        variant="quiet-danger"
        className="px-3"
        aria-expanded={confirming}
        aria-label={`Delete the bucket ${bucket.name}`}
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
      {confirming ? (
        <ConfirmInline
          className="mt-[var(--space-md)] w-full"
          confirmLabel="Delete the bucket"
          onConfirm={onDrop}
          onCancel={() => setConfirming(false)}
        >
          Delete <code>{bucket.name}</code> and its {bucket.objects} object
          {bucket.objects === 1 ? "" : "s"}? The files go too, and nothing brings them back.
        </ConfirmInline>
      ) : null}
    </>
  );
}
