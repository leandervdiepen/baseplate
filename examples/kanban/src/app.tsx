import { useEffect, useState } from "react";
import { client } from "./client.ts";
import type { AuthSession } from "@diepen/baseplate/client";
import type { BoardsRow } from "./database.ts";
import { SignIn } from "./features/sign-in.tsx";
import { Boards } from "./features/boards.tsx";
import { Board } from "./features/board.tsx";

export function App() {
  const [session, setSession] = useState<AuthSession | undefined>(client.auth.getSession());
  const [board, setBoard] = useState<BoardsRow | null>(null);

  // The session survives a reload and refreshes itself before it expires, so
  // this only has to react to it changing.
  useEffect(() => client.auth.onAuthStateChange(setSession), []);

  if (!session) {
    return <SignIn />;
  }

  return (
    <>
      <header className="topbar">
        <h1>Kanban</h1>
        <span className="spacer" />
        <span className="who">{session.user.email}</span>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setBoard(null);
            void client.auth.signOut();
          }}
        >
          Sign out
        </button>
      </header>
      <main>
        {board ? (
          <Board board={board} onBack={() => setBoard(null)} />
        ) : (
          <Boards onOpen={setBoard} />
        )}
      </main>
    </>
  );
}
