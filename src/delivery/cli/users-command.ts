import { createInterface } from "node:readline/promises";
import type { UserAdmin } from "#application";
import { DomainError } from "#domain";

export const USERS_USAGE = `Usage: baseplate users <command>

  list [--email <part>]          Who has an account, newest first
  create --email <address> [--password <secret>]
                                 Make an account. Prompts for the password
                                 when you leave it off, so it stays off your
                                 shell history. Confirmed, so they can sign in
  delete <id> [--yes]            Remove an account. Their rows stay
  reset <id>                     Print a one-hour password reset link
  revoke <id>                    End every session this person has open

Your app makes users through client.auth.signUp. These are the operator's
door, for fixing an account or letting someone back in.`;

export type UsersArgs = {
  readonly email?: string;
  readonly password?: string;
  readonly yes: boolean;
  /** Where a reset link points. The app dev serves that page, not Baseplate. */
  readonly siteUrl: string;
};

const PAGE = 50;

export async function runUsersCommand(
  users: UserAdmin,
  action: string | undefined,
  positionals: readonly (string | undefined)[],
  args: UsersArgs,
  print: (line: string) => void,
): Promise<void> {
  if (action === undefined || action === "help") {
    print(USERS_USAGE);
    return;
  }

  if (action === "list") {
    const { users: rows, total } = await users.listUsers({
      ...(args.email ? { search: args.email } : {}),
      limit: PAGE,
      offset: 0,
    });
    if (rows.length === 0) {
      print(
        args.email
          ? `Nobody matches '${args.email}'.`
          : "No users yet. Your app's signup makes them, or `baseplate users create` does.",
      );
      return;
    }
    for (const row of rows) {
      const seen = row.lastSignInAt ? row.lastSignInAt : "never signed in";
      const state = row.emailConfirmedAt ? "confirmed" : "unconfirmed";
      print(`${row.id}  ${row.email}  ${state}  ${seen}`);
    }
    if (total > rows.length) {
      print(`Showing ${rows.length} of ${total}. Narrow it with --email <part>.`);
    }
    return;
  }

  if (action === "create") {
    if (!args.email) {
      throw new DomainError("cli.email_required", "`users create` needs --email <address>.");
    }
    const password = args.password ?? (await askForPassword());
    const user = await users.createUser(args.email, password, true);
    print(`Made ${user.email}. Their id is ${user.id}, which is what owns their rows.`);
    return;
  }

  const id = positionals[0];
  if (!id) {
    throw new DomainError("cli.user_id_required", `\`users ${action}\` needs a user id.`);
  }

  if (action === "delete") {
    await confirmDelete(id, args.yes);
    if (!(await users.deleteUser(id))) {
      throw new DomainError("users.not_found", `There is no user with id ${id}.`);
    }
    print(`Removed ${id}. Their rows are still there, owned by an id nobody holds.`);
    return;
  }

  if (action === "reset") {
    const { link, expiresAt } = await users.createRecoveryLink(id, args.siteUrl);
    print(link);
    print(`Good until ${expiresAt}. Hand it over yourself; nothing was emailed.`);
    return;
  }

  if (action === "revoke") {
    const revoked = await users.revokeSessions(id);
    print(
      revoked === 0
        ? `${id} had no sessions open.`
        : `Ended ${revoked} session(s). Their access token still works until it expires.`,
    );
    return;
  }

  throw new DomainError(
    "cli.unknown_users_command",
    `Unknown users command '${action}'.\n\n${USERS_USAGE}`,
  );
}

/**
 * Asked for rather than taken as a flag, so someone else's password does not
 * end up in shell history or a process list. A pipe has nobody to ask.
 */
async function askForPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new DomainError(
      "cli.password_required",
      "Pass --password when there is nobody to answer a prompt.",
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Password for the new account: ");
  rl.close();
  return answer.trim();
}

/** Deleting someone is not undoable, so it asks, the way `destroy` does. */
async function confirmDelete(id: string, assumeYes: boolean): Promise<void> {
  if (assumeYes) {
    return;
  }
  if (!process.stdin.isTTY) {
    throw new DomainError(
      "cli.confirm_required",
      "delete removes an account. Pass --yes when there is nobody to answer a prompt.",
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `This removes the account ${id}. Their rows stay.\nType 'yes' to confirm: `,
  );
  rl.close();
  if (answer.trim() !== "yes") {
    throw new DomainError("cli.not_confirmed", "Nobody was removed.");
  }
}
