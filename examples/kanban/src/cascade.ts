import { client } from "./client.ts";

/**
 * `schema add-table` declares no foreign keys, so there is no ON DELETE CASCADE
 * to lean on. Deleting a parent means deleting its children first, and each
 * delete is still scoped by row access: a caller can only reach their own rows,
 * so nobody else's board loses a list.
 */

export async function deleteList(listId: string): Promise<string | null> {
  const cards = await client.from("cards").delete().eq("list_id", listId);
  if (cards.error) {
    return cards.error.message;
  }
  const list = await client.from("lists").delete().eq("id", listId);
  return list.error ? list.error.message : null;
}

export async function deleteBoard(boardId: string): Promise<string | null> {
  const lists = await client.from("lists").select("id").eq("board_id", boardId);
  if (lists.error) {
    return lists.error.message;
  }
  const listIds = (lists.data ?? []).map((list) => list.id);
  if (listIds.length > 0) {
    const cards = await client.from("cards").delete().in("list_id", listIds);
    if (cards.error) {
      return cards.error.message;
    }
  }
  const removed = await client.from("lists").delete().eq("board_id", boardId);
  if (removed.error) {
    return removed.error.message;
  }
  const board = await client.from("boards").delete().eq("id", boardId);
  return board.error ? board.error.message : null;
}
