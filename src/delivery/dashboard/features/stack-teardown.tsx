import { useState } from "react";
import { ConfirmInline } from "../patterns/confirm-inline.tsx";
import { Section } from "../patterns/section.tsx";
import { Button } from "../primitives/button.tsx";

/**
 * The two ways to take a stack down, kept apart from the settings form above
 * them: nothing here is saved, and one of them cannot be undone.
 */
export function StackTeardown({
  busy,
  onStop,
  onDestroy,
}: {
  busy: boolean;
  onStop: () => void;
  /** Answers whether the volume actually went, so the question can close. */
  onDestroy: () => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Section
      divided={false}
      className="max-w-[var(--container-form)] items-start"
      title="Stopping and starting"
      description="Stopping keeps everything. Destroying deletes the volume your rows live in, which is the only copy unless a backup has been taken."
    >
      <Button variant="secondary" busy={busy && !confirming} onClick={onStop}>
        Stop the stack
      </Button>

      {confirming ? (
        <ConfirmInline
          className="w-full"
          confirmLabel="Delete the data"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            void onDestroy().then((gone) => {
              if (gone) {
                setConfirming(false);
              }
            })
          }
        >
          Delete this project&apos;s database volume? Every row goes with it, and nothing brings
          them back.
        </ConfirmInline>
      ) : (
        <Button
          variant="quiet-danger"
          className="self-start px-3"
          onClick={() => setConfirming(true)}
        >
          Destroy this project&apos;s data
        </Button>
      )}
    </Section>
  );
}
