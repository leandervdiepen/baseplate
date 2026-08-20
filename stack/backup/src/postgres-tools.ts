import { spawn } from "node:child_process";

export type PostgresSettings = {
  host: string;
  database: string;
  password: string;
};

/**
 * pg_dump and pg_restore, run as the superuser over the compose network. They
 * live in this image so the operator needs nothing installed on their machine,
 * and so a drill can run on the server where the database actually is.
 */
export function postgresTools(settings: PostgresSettings) {
  const env = { ...process.env, PGPASSWORD: settings.password };
  const connection = ["-h", settings.host, "-U", "postgres"];

  return {
    /**
     * Custom format, so a restore can be selective and compressed.
     *
     * The request queue's schema is left out on purpose. A restore replaces
     * everything in the dump, and the row asking for the restore lives in that
     * queue: put it in and the restore erases the note it is answering, so
     * whoever asked waits for a reply that can no longer be written.
     */
    dump(target: string): Promise<void> {
      return run(
        "pg_dump",
        [
          ...connection,
          "-d",
          settings.database,
          "-Fc",
          "--exclude-schema",
          "baseplate_control",
          "-f",
          target,
        ],
        env,
      );
    },

    restore(source: string, database: string, clean: boolean): Promise<void> {
      return run(
        "pg_restore",
        [
          ...connection,
          "-d",
          database,
          ...(clean ? ["--clean", "--if-exists"] : []),
          "--no-owner",
          // A restore into a scratch database reports harmless errors for roles
          // and extensions that are already there. Only a failed exit matters.
          "--exit-on-error",
          source,
        ],
        env,
      );
    },

    psql(database: string, sql: string): Promise<string> {
      return capture("psql", [...connection, "-d", database, "-tAc", sql], env);
    },
  };
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "inherit", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited ${String(code)}: ${stderr.trim().slice(-500)}`));
    });
  });
}

function capture(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      out += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(`${command} exited ${String(code)}: ${err.trim()}`)),
    );
  });
}
