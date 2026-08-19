import { useCallback, useEffect, useState } from "react";
import { client } from "../client.ts";
import type { BoardsRow, CardsRow, ListsRow } from "../database.ts";
import { List } from "./list.tsx";
import { positionBetween } from "../position.ts";

export function Board({ board, onBack }: { board: BoardsRow; onBack: () => void }) {
  const [lists, setLists] = useState<ListsRow[]>([]);
  const [cards, setCards] = useState<CardsRow[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const load = useCallback(async () => {
    const listed = await client
      .from("lists")
      .select()
      .eq("board_id", board.id)
      .order("position");
    if (listed.error) {
      setError(listed.error.message);
      return;
    }
    const rows = listed.data ?? [];
    setLists(rows);
    if (rows.length === 0) {
      setCards([]);
      return;
    }
    const held = await client
      .from("cards")
      .select()
      .in("list_id", rows.map((list) => list.id))
      .order("position");
    if (held.error) {
      setError(held.error.message);
      return;
    }
    setError(null);
    setCards(held.data ?? []);
  }, [board.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addList(): Promise<void> {
    const name = title.trim();
    if (!name) {
      return;
    }
    const last = lists.at(-1)?.position ?? 0;
    const { error: failure } = await client
      .from("lists")
      .insert({ board_id: board.id, title: name, position: last + 1 });
    if (failure) {
      setError(failure.message);
      return;
    }
    setTitle("");
    await load();
  }

  /**
   * Dropping on a card puts the dragged one before it; dropping on the list
   * itself puts it at the end. The new position is the midpoint of its new
   * neighbours, so only the row that moved is written.
   */
  async function drop(listId: string, beforeCardId: string | null): Promise<void> {
    const id = dragging;
    setDragging(null);
    if (!id) {
      return;
    }
    const inList = cards.filter((card) => card.list_id === listId && card.id !== id);
    const index = beforeCardId ? inList.findIndex((card) => card.id === beforeCardId) : inList.length;
    const at = index === -1 ? inList.length : index;
    const position = positionBetween(inList[at - 1]?.position, inList[at]?.position);

    setCards((current) =>
      current.map((card) => (card.id === id ? { ...card, list_id: listId, position } : card)),
    );
    const { error: failure } = await client
      .from("cards")
      .update({ list_id: listId, position })
      .eq("id", id);
    if (failure) {
      setError(failure.message);
    }
    await load();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button className="button secondary" type="button" onClick={onBack}>
          All boards
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>{board.title}</h2>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="lists">
        {lists.map((list) => (
          <List
            key={list.id}
            list={list}
            cards={cards.filter((card) => card.list_id === list.id)}
            dragging={dragging}
            onDragCard={setDragging}
            onDrop={drop}
            onChanged={load}
            onError={setError}
          />
        ))}
        <form
          className="list"
          onSubmit={(event) => {
            event.preventDefault();
            void addList();
          }}
        >
          <label className="hint" htmlFor="list-title">
            New list
          </label>
          <div className="add">
            <input
              id="list-title"
              className="input"
              placeholder="To do"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <button className="button" type="submit">
              Add
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
