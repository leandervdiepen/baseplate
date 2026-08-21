import { DomainError } from "#domain";
import type { Operator } from "#infrastructure";
import { asString, objectArgs, ok, requireConfirm, requireString, type ToolResult } from "./helpers.ts";

export async function handleUsers(
  operator: Operator,
  params: unknown,
  siteUrl: string,
): Promise<ToolResult> {
  const args = objectArgs(params);
  const command = requireString(args, "command", "mcp.users_command", "users needs command.");
  if (command === "list") {
    const email = asString(args, "email");
    return ok(await operator.users.list(email ? { search: email } : {}));
  }
  if (command === "create") {
    const email = requireString(args, "email", "cli.email_required", "users create needs email.");
    const password = requireString(
      args,
      "password",
      "cli.password_required",
      "users create needs password. Stdio cannot prompt.",
    );
    return ok(await operator.users.create(email, password));
  }
  const id = requireString(args, "id", "cli.user_id_required", `users ${command} needs id.`);
  if (command === "delete") {
    requireConfirm(args, "delete");
    await operator.users.remove(id);
    return ok({ id, deleted: true });
  }
  if (command === "reset") {
    return ok(await operator.users.recoveryLink(id, siteUrl));
  }
  if (command === "revoke") {
    return ok({ id, revoked: await operator.users.revokeSessions(id) });
  }
  throw new DomainError("cli.unknown_users_command", `Unknown users command '${command}'.`);
}
