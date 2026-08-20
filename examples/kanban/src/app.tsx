import { useEffect, useState } from "react";
import { client } from "./client.ts";
import type { AuthSession } from "@diepen/baseplate/client";
import type { BoardsRow } from "./database.ts";
import { SignIn } from "./features/sign-in.tsx";
import { ResetPassword } from "./features/reset-password.tsx";
import { Boards } from "./features/boards.tsx";
import { Board } from "./features/board.tsx";

/**
 * The recovery email links to {SITE_URL}/reset-password?token=... so either half
 * of that is enough to mean "the user is here to set a new password".
 */
function resetTokenFromUrl(): string | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (token) {
    return token;
  }
  return url.pathname === "/reset-password" ? "" : null;
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(client.auth.getSession());
  const [resetToken, setResetToken] = useState<string | null>(resetTokenFromUrl);
  const [board, setBoard] = useState<BoardsRow | null>(null);

  // The session survives a reload and refreshes itself before it expires, so
  // this only has to react to it changing.
  useEffect(() => client.auth.onAuthStateChange((_event, next) => setSession(next)), []);

  if (resetToken !== null) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={() => {
          setResetToken(null);
          window.history.replaceState(null, "", "/");
        }}
      />
    );
  }

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
