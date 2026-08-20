import { mkdir } from "node:fs/promises";
import { parseTtl } from "../../shared/ttl.ts";
import { connectBackupDb } from "./db.ts";
import { destinationFromEnv } from "./destination.ts";
import { createJobs } from "./jobs.ts";
import { postgresTools } from "./postgres-tools.ts";

const SCRATCH = process.env.BACKUP_SCRATCH ?? "/scratch";
const LOCAL_ROOT = process.env.BACKUP_LOCAL_DIR ?? "/backups";
const DATABASE = process.env.POSTGRES_DB ?? "app";
const HOST = process.env.POSTGRES_HOST ?? "postgres";
const CHANNEL = "baseplate_backup";
/** How often the pending queue is looked at when no notification arrives. */
const POLL_MS = 30_000;

function log(line: string): void {
  process.stdout.write(`backup: ${line}\n`);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

const every = parseTtl(process.env.BACKUP_EVERY ?? "", "24h") * 1000;
const drillEvery = parseTtl(process.env.DRILL_EVERY ?? "", "168h") * 1000;
const keep = Math.max(Number(process.env.BACKUP_KEEP ?? "14") || 14, 1);

const db = connectBackupDb({
  host: HOST,
  database: DATABASE,
  password: required("POSTGRES_PASSWORD"),
});
const destination = destinationFromEnv(process.env, LOCAL_ROOT);
const jobs = createJobs({
  db,
  destination,
  tools: postgresTools({ host: HOST, database: DATABASE, password: required("POSTGRES_PASSWORD") }),
  key: required("BACKUP_KEY"),
  database: DATABASE,
  scratch: SCRATCH,
  keep,
  log,
});

await mkdir(SCRATCH, { recursive: true });
await mkdir(LOCAL_ROOT, { recursive: true });

log(`ready. Every ${String(every / 1000)}s to ${destination.label}, keeping ${String(keep)}.`);
if (!destination.offMachine) {
  log("This destination is on the same machine as the database. Name a bucket to change that.");
}

let working = false;

/** One at a time: two pg_restores over one database is not a thing to allow. */
async function tick(): Promise<void> {
  if (working) {
    return;
  }
  working = true;
  try {
    await drainRequests();
    await runSchedule();
  } catch (error) {
    log(`failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    working = false;
  }
}

async function drainRequests(): Promise<void> {
  for (;;) {
    const request = await db.claimRequest();
    if (!request) {
      return;
    }
    try {
      if (request.kind === "backup") {
        const made = await jobs.backup(stamp());
        await db.finishRequest(request.id, true, `Backed up as ${made.key}.`);
      } else if (request.kind === "drill") {
        await jobs.drill(await db.newest());
        await db.finishRequest(request.id, true, "Drill complete.");
      } else {
        const wanted = request.backupId ? await db.byId(request.backupId) : await db.newest();
        if (!wanted) {
          await db.finishRequest(request.id, false, "There is no such backup to restore.");
          continue;
        }
        await jobs.restore(wanted);
        await db.finishRequest(request.id, true, `Restored ${wanted.key}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.finishRequest(request.id, false, message);
      log(`request ${String(request.id)} failed: ${message}`);
    }
  }
}

async function runSchedule(): Promise<void> {
  const now = Date.now();
  const lastBackup = await db.lastBackupAt();
  if (!lastBackup || now - lastBackup.getTime() >= every) {
    await jobs.backup(stamp());
  }
  const lastDrill = await db.lastDrillAt();
  if (!lastDrill || now - lastDrill.getTime() >= drillEvery) {
    await jobs.drill(await db.newest());
  }
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// The operator asks for a backup by writing a row and notifying, so nothing has
// to open a port that is not already there.
await db.listen(CHANNEL, () => void tick());
setInterval(() => void tick(), POLL_MS);
void tick();
