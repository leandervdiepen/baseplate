import { useState } from "react";
import { client } from "../client.ts";
import { deleteList } from "../cascade.ts";
import { Attachments } from "./attachments.tsx";
import type { CardsRow, ListsRow } from "../database.ts";

export function List({
  list,
  cards,
  dragging,
  onDragCard,
  onDrop,
  onChanged,
  onError,
}: {
  list: ListsRow;
  cards: CardsRow[];
  dragging: string | null;
  onDragCard: (id: string | null) => void;
  onDrop: (listId: string, beforeCardId: string | null) => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [over, setOver] = useState(false);

  async function addCard(): Promise<void> {
    const name = title.trim();
    if (!name) {
      return;
    }
    const last = cards.at(-1)?.position ?? 0;
    const { error } = await client
      .from("cards")
      .insert({ list_id: list.id, title: name, position: last + 1 });
    if (error) {
      onError(error.message);
      return;
    }
    setTitle("");
    await onChanged();
  }

  async function removeCard(id: string): Promise<void> {
    await client.from("cards").delete().eq("id", id);
    await onChanged();
  }

  async function removeList(): Promise<void> {
    const failure = await deleteList(list.id);
    if (failure) {
      onError(failure);
    }
    await onChanged();
  }

  return (
    <section
      className="list"
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onDrop(list.id, null);
      }}
    >
      <div className="list-head">
        <h3>{list.title}</h3>
        <span className="count">{cards.length}</span>
        <button
          className="button ghost"
          type="button"
          aria-label={`Delete list ${list.title}`}
          onClick={() => void removeList()}
        >
          Delete
        </button>
      </div>

      <div className={over ? "cards over" : "cards"}>
        {cards.map((card) => (
          <article
            key={card.id}
            className={dragging === card.id ? "kcard dragging" : "kcard"}
            draggable
            onDragStart={() => onDragCard(card.id)}
            onDragEnd={() => onDragCard(null)}
            onDragOver={(event) => event.stopPropagation()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOver(false);
              onDrop(list.id, card.id);
            }}
          >
            <div className="kcard-top">
              <span>{card.title}</span>
              <button
                className="button ghost"
                type="button"
                aria-label={`Delete card ${card.title}`}
                onClick={() => void removeCard(card.id)}
              >
                ×
              </button>
            </div>
            <Attachments cardId={card.id} onError={onError} />
          </article>
        ))}
      </div>

      <form
        className="add"
        onSubmit={(event) => {
          event.preventDefault();
          void addCard();
        }}
      >
        <label className="hint" htmlFor={`card-${list.id}`} style={{ position: "absolute", left: -9999 }}>
          New card in {list.title}
        </label>
        <input
          id={`card-${list.id}`}
          className="input"
          placeholder="Add a card"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="button secondary" type="submit">
          Add
        </button>
      </form>
    </section>
  );
}
