import { useCallback, useEffect, useState } from "react";
import { listUsers, type OperatorUser, type UserPage } from "../lib/api/index.ts";
import { UserCreate } from "./user-create.tsx";
import { UserDrawer } from "./user-drawer.tsx";
import { UsersGrid } from "./users-grid.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { IconUsers } from "../primitives/icon.tsx";
import { Field, Input } from "../primitives/input.tsx";

const PAGE = 25;

type Panel = { kind: "create" } | { kind: "manage"; user: OperatorUser } | null;

/**
 * Everyone who can sign in to this project. The database answers every search
 * and every page, so what is on screen is what the stack actually holds.
 * A panel, not a page: the Auth view composes it above the token tooling.
 */
export function UsersPanel({
  apiUp,
  onProvision,
}: {
  apiUp: boolean;
  onProvision: () => Promise<void>;
}) {
  const [page, setPage] = useState<UserPage | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setPage(await listUsers({ search, limit: PAGE, offset }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read your users.");
      setPage({ live: false, total: 0, users: [] });
    } finally {
      setBusy(false);
    }
  }, [search, offset]);

  useEffect(() => {
    if (apiUp) {
      void load();
    }
  }, [apiUp, load]);

  /**
   * A drawer finished something. Say so here, above the list, then re-read the
   * list: the panel that did the work is already gone by then.
   */
  function settled(message: string): void {
    setError(null);
    setSaid(message);
    void load();
  }

  const down = !apiUp || page?.live === false;

  return (
    <>
      <StatusMessage message={said} className="mb-4 block" />
      <StatusMessage message={error} tone="error" className="mb-4 block" />

      {down ? (
        <EmptyState
          icon={<IconUsers width={20} height={20} />}
          title="The stack is not running"
          description="Your users live in the database, and it is not up. Start the stack to manage them."
          action={<Button onClick={() => void onProvision()}>Start the stack</Button>}
        />
      ) : (
        <>
          <div className="mb-[var(--space-md)] flex flex-wrap items-end gap-[var(--space-sm)]">
            <form
              className="min-w-[13rem] max-w-[20rem] flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                setOffset(0);
                setSearch(draft.trim());
              }}
            >
              {/* The database does the searching. Enter asks it. */}
              <Field label="Search users by email" hideLabel>
                <Input
                  type="search"
                  value={draft}
                  placeholder="Search by email"
                  autoComplete="off"
                  onChange={(event) => setDraft(event.target.value)}
                />
              </Field>
            </form>
            <Button variant="ghost" busy={busy} onClick={() => void load()}>
              Refresh
            </Button>
            <Button className="ms-auto" onClick={() => setPanel({ kind: "create" })}>
              Add user
            </Button>
          </div>

          {page ? (
            <UsersGrid
              users={page.users}
              total={page.total}
              offset={offset}
              limit={PAGE}
              searching={search.length > 0}
              onPage={setOffset}
              onAdd={() => setPanel({ kind: "create" })}
              onManage={(user) => setPanel({ kind: "manage", user })}
            />
          ) : null}
        </>
      )}

      {panel?.kind === "create" ? (
        <UserCreate
          onClose={() => setPanel(null)}
          onCreated={(email) => {
            setPanel(null);
            settled(`Added ${email}.`);
          }}
        />
      ) : null}

      {panel?.kind === "manage" ? (
        <UserDrawer
          user={panel.user}
          onClose={() => setPanel(null)}
          onDeleted={(email) => {
            setPanel(null);
            settled(`Deleted ${email}. Their rows are still there.`);
          }}
        />
      ) : null}
    </>
  );
}
