import { createServer } from "node:http";
import { connectAuthDb } from "./db.ts";
import { handleAuthRequest } from "./handle.ts";
import { tokenSecret } from "./token.ts";

const port = Number(process.env.PORT ?? "3001");
const postgresPassword = required("POSTGRES_PASSWORD");
const authPassword = required("AUTH_SERVICE_PASSWORD");
const secret = tokenSecret(required("JWT_SECRET"));
const role = process.env.CALLER_ROLE || "app_user";

const db = await connectAuthDb({ postgresPassword, authPassword });
const server = createServer((req, res) => {
  void handleAuthRequest({ db, secret, role }, req, res).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error.";
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: "auth.internal", message }));
  });
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`auth listening on ${port}\n`);
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}
