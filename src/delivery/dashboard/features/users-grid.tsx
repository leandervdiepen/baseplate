import type { OperatorUser } from "../lib/api/index.ts";
import { shortId } from "../lib/format.ts";
import { DataGrid } from "../patterns/data-grid.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { Cell, Row } from "../patterns/table.tsx";
import { Button } from "../primitives/button.tsx";
import { MonoChip, StatusPill } from "../primitives/chip.tsx";
import { CopyButton } from "../primitives/copy-button.tsx";
import { IconUsers } from "../primitives/icon.tsx";

/**
 * One page of users, exactly as the database returned them. Nothing here
 * filters, sorts, or counts after the fact.
 */
export function UsersGrid({
  users,
  total,
  offset,
  limit,
  searching,
  onPage,
  onAdd,
  onManage,
}: {
  users: OperatorUser[];
  total: number;
  offset: number;
  limit: number;
  /** A search is on, so nothing found means nothing matched, not nothing exists. */
  searching: boolean;
  onPage: (offset: number) => void;
  onAdd: () => void;
  onManage: (user: OperatorUser) => void;
}) {
  if (users.length === 0) {
    return searching ? (
      <EmptyState
        icon={<IconUsers width={20} height={20} />}
        title="Nothing matches that search"
        description="No account's email contains what you typed. Clear the search to see everyone again."
      />
    ) : (
      <EmptyState
        icon={<IconUsers width={20} height={20} />}
        title="No users yet"
        description="Apps create these with client.auth.signUp. Add one by hand to try it."
        action={<Button onClick={onAdd}>Add user</Button>}
      />
    );
  }

  return (
    <>
      <DataGrid
        caption="Users who can sign in to this project"
        columns={[
          { key: "email", label: "email" },
          { key: "id", label: "id", width: "var(--size-col-id)" },
          { key: "created", label: "created", width: "12rem" },
          { key: "signed-in", label: "last sign-in", width: "12rem" },
          { key: "status", label: "status", width: "7.5rem" },
          { key: "manage", label: "manage", width: "7.5rem" },
        ]}
      >
        {users.map((user) => (
          <Row key={user.id}>
            <Cell>{user.email}</Cell>
            <Cell width="var(--size-col-id)">
              {/* The padding is what keeps a 40px control off the row's own
                  borders, and every row carries one, so they stay level. */}
              <span className="flex items-center gap-1.5 py-1.5">
                <MonoChip>{shortId(user.id)}</MonoChip>
                <CopyButton className="px-2" value={user.id} label="Copy id" />
              </span>
            </Cell>
            <Cell width="12rem" mono muted>
              {new Date(user.createdAt).toLocaleString()}
            </Cell>
            <Cell width="12rem" mono muted={!user.lastSignInAt}>
              {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : "never"}
            </Cell>
            <Cell width="7.5rem">
              {user.emailConfirmedAt ? (
                <StatusPill tone="accent">confirmed</StatusPill>
              ) : (
                <StatusPill>pending</StatusPill>
              )}
            </Cell>
            <Cell width="7.5rem">
              {/* The name is in the row, not on the button, so the button says
                  whose it is to anyone who cannot see the row. */}
              <Button variant="ghost" className="px-2" onClick={() => onManage(user)}>
                Manage<span className="sr-only"> {user.email}</span>
              </Button>
            </Cell>
          </Row>
        ))}
      </DataGrid>

      <div className="mt-[var(--space-md)] flex flex-wrap items-center gap-[var(--space-md)]">
        <p className="text-[length:var(--text-sm)] tabular-nums text-[var(--color-text-muted)]">
          Rows {offset + 1}&ndash;{offset + users.length} of {total}
        </p>
        <div className="ms-auto flex gap-2">
          <Button
            variant="secondary"
            disabled={offset === 0}
            onClick={() => onPage(Math.max(offset - limit, 0))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={users.length < limit || offset + limit >= total}
            onClick={() => onPage(offset + limit)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
