import { useState } from "react";
import type { OperatorUser } from "../lib/api/index.ts";
import { UserCreate } from "./user-create.tsx";
import { UserDrawer } from "./user-drawer.tsx";
import { UsersGrid } from "./users-grid.tsx";
import { useUsers } from "./use-users.ts";
import { EmptyState } from "../patterns/empty-state.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { IconUsers } from "../primitives/icon.tsx";
import { Field, Input } from "../primitives/input.tsx";

type Panel = { kind: "create" } | { kind: "manage"; user: OperatorUser } | null;

/**
 * Everyone who can sign in to this project, and the ways to add or remove one.
 * A panel, not a page: the Auth view composes it above the token tooling.
 */
export function UsersPanel({
  apiUp,
  onProvision,
}: {
  apiUp: boolean;
  onProvision: () => Promise<void>;
}) {
  const people = useUsers(apiUp);
  const [draft, setDraft] = useState("");
  const [panel, setPanel] = useState<Panel>(null);

  const down = !apiUp || people.page?.live === false;

  return (
    <>
      <StatusMessage message={people.said} className="mb-4 block" />
      <StatusMessage message={people.error} tone="error" className="mb-4 block" />

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
                people.searchFor(draft.trim());
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
            <Button variant="ghost" busy={people.busy} onClick={people.refresh}>
              Refresh
            </Button>
            <Button className="ms-auto" onClick={() => setPanel({ kind: "create" })}>
              Add user
            </Button>
          </div>

          {people.page ? (
            <UsersGrid
              users={people.page.users}
              total={people.page.total}
              offset={people.offset}
              limit={people.limit}
              searching={people.searching}
              onPage={people.setOffset}
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
            people.settled(`Added ${email}.`);
          }}
        />
      ) : null}

      {panel?.kind === "manage" ? (
        <UserDrawer
          user={panel.user}
          onClose={() => setPanel(null)}
          onDeleted={(email) => {
            setPanel(null);
            people.settled(`Deleted ${email}. Their rows are still there.`);
          }}
        />
      ) : null}
    </>
  );
}
