import { useCallback, useEffect, useState } from "react";
import { client } from "../client.ts";
import type { BoardsRow } from "../database.ts";

export function Boards({ onOpen }: { onOpen: (board: BoardsRow) => void }) {
  const [boards, setBoards] = useState<BoardsRow[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: failure } = await client.from("boards").select().order("created_at");
    if (failure) {
      setError(failure.message);
      return;
    }
    setError(null);
    setBoards(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(): Promise<void> {
    const name = title.trim();
    if (!name) {
      return;
    }
    setBusy(true);
    // owner_id is never sent. The database stamps it from the token.
    const { error: failure } = await client.from("boards").insert({ title: name });
    setBusy(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    setTitle("");
    await load();
  }

  async function remove(board: BoardsRow): Promise<void> {
    await client.from("boards").delete().eq("id", board.id);
    await load();
  }

  return (
    <>
      <form
        className="add"
        style={{ maxWidth: 420, marginBottom: 20 }}
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label className="hint" htmlFor="board-title" style={{ position: "absolute", left: -9999 }}>
          Board name
        </label>
        <input
          id="board-title"
          className="input"
          placeholder="New board name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="button" type="submit" disabled={busy}>
          Add board
        </button>
      </form>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {boards.length === 0 ? (
        <p className="empty">No boards yet. Name one above and it is yours.</p>
      ) : (
        <div className="boards">
          {boards.map((board) => (
            <div key={board.id} className="board-tile">
              <button
                type="button"
                onClick={() => onOpen(board)}
                style={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0 }}
              >
                {board.title}
              </button>
              <button
                className="button ghost"
                type="button"
                aria-label={`Delete board ${board.title}`}
                onClick={() => void remove(board)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
