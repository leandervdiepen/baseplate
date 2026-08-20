import { DomainError } from "#domain";
import type { Operator } from "#infrastructure";
import { asString, objectArgs, ok, requireConfirm, requireString, type ToolResult } from "./helpers.ts";

const PAGE = 50;

export async function handleUsers(
  operator: Operator,
  params: unknown,
  siteUrl: string,
): Promise<ToolResult> {
  const args = objectArgs(params);
  const command = requireString(args, "command", "mcp.users_command", "users needs command.");
  if (command === "list") {
    const email = asString(args, "email");
    return ok(
      await operator.users.listUsers({
        ...(email ? { search: email } : {}),
        limit: PAGE,
        offset: 0,
      }),
    );
  }
  if (command === "create") {
    const email = requireString(args, "email", "cli.email_required", "users create needs email.");
    const password = requireString(
      args,
      "password",
      "cli.password_required",
      "users create needs password. Stdio cannot prompt.",
    );
    return ok(await operator.users.createUser(email, password, true));
  }
  const id = requireString(args, "id", "cli.user_id_required", `users ${command} needs id.`);
  if (command === "delete") {
    requireConfirm(args, "delete");
    if (!(await operator.users.deleteUser(id))) {
      throw new DomainError("users.not_found", `There is no user with id ${id}.`);
    }
    return ok({ id, deleted: true });
  }
  if (command === "reset") {
    return ok(await operator.users.createRecoveryLink(id, siteUrl));
  }
  if (command === "revoke") {
    return ok({ id, revoked: await operator.users.revokeSessions(id) });
  }
  throw new DomainError("cli.unknown_users_command", `Unknown users command '${command}'.`);
}
