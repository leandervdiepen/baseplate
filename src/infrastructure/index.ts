import {
  ChangeSchema,
  InspectSchema,
  ManageBackups,
  ManageStorage,
  ManageUsers,
  MintToken,
  ProvisionStack,
  TeardownStack,
} from "#application";
import type { CloudProvider, StackRuntime, StackStateStore } from "#application";
import type { Stack } from "#domain";
import { InfraError } from "#shared";
import { SystemClock } from "./clock/index.ts";
import { DockerComposeRuntime, DockerHostCloudProvider } from "./docker/index.ts";
import { FileStackStateStore } from "./fs/index.ts";
import { HetznerCloudProvider } from "./hetzner/index.ts";
import { JwtTokenSigner } from "./jwt/index.ts";
import type { PostgresAdminConfig } from "./postgres/index.ts";
import {
  PostgresBackupAdmin,
  PostgresSchemaAdmin,
  PostgresStorageAdmin,
  PostgresUserAdmin,
} from "./postgres/index.ts";
import { openTunnel, RemoteComposeRuntime } from "./ssh/index.ts";

export { SystemClock } from "./clock/index.ts";
export { assertPassword, hashPassword } from "./crypto/index.ts";
export {
  composeEnv,
  DockerComposeRuntime,
  DockerHostCloudProvider,
  parseRunningStacks,
  runningStacks,
} from "./docker/index.ts";
export { FileProjectDirectory, FileStackStateStore } from "./fs/index.ts";
export { HetznerAccount, HetznerCloudProvider, syncTerraformDir } from "./hetzner/index.ts";
export { JwtTokenSigner } from "./jwt/index.ts";
export {
  MemoryClock,
  MemoryCloudProvider,
  MemorySchemaAdmin,
  MemoryStackRuntime,
  MemoryStackStateStore,
  MemoryTokenSigner,
  MemoryUserAdmin,
} from "./memory/index.ts";
export {
  PostgresBackupAdmin,
  PostgresSchemaAdmin,
  PostgresStorageAdmin,
  PostgresUserAdmin,
} from "./postgres/index.ts";
export { closeTunnels, RemoteComposeRuntime, tunnelArgs } from "./ssh/index.ts";

export type OperatorTarget = "local" | "hetzner";

/**
 * Where the operator's database actually is.
 *
 * This used to be `127.0.0.1` whatever the target, which meant that pointing a
 * project at Hetzner and then applying a schema change, listing tables, or
 * reading history could reach a local stack that happened to be on the same
 * port. The operator would be told they were managing their server while they
 * were editing their laptop.
 *
 * On a remote target the stack publishes Postgres on the server's loopback and
 * the firewall opens 22, 80 and 443, so the only way in is the SSH access
 * provisioning already set up.
 */
async function databaseEndpoint(
  config: OperatorConfig,
  store: StackStateStore,
): Promise<PostgresAdminConfig> {
  const database = {
    database: config.stack.databaseName,
    password: config.postgresPassword,
  };
  if (config.target === "local") {
    return { ...database, host: "127.0.0.1", port: config.postgresPort };
  }
  const record = await store.load();
  if (!record) {
    throw new InfraError(
      "stack.not_provisioned",
      "This project targets Hetzner and has no server yet. Provision it from Settings.",
    );
  }
  return {
    ...database,
    host: "127.0.0.1",
    port: await openTunnel({
      host: record.server.ipv4,
      user: "root",
      remoteHost: "127.0.0.1",
      remotePort: config.postgresPort,
    }),
  };
}

export type OperatorConfig = {
  target: OperatorTarget;
  jwtSecret: string;
  stack: Stack;
  stackDir: string;
  projectName: string;
  /** The operator's own directory, stamped onto containers so it can be named. */
  projectRoot: string;
  envFile: string;
  postgresPassword: string;
  postgresPort: number;
  statePath: string;
  httpPort: number;
  /** Terraform as shipped, read-only. */
  infraSourceDir: string;
  /** Where this project's Terraform state and providers live. */
  infraWorkDir: string;
  hcloudToken: string;
  hetznerDnsToken: string;
  hetznerDnsZone: string;
  sshKeyName: string;
  serverLocation: string;
  /** What a minted caller token is good for, from ACCESS_TOKEN_TTL. */
  accessTtlSeconds: number;
};

/**
 * What an operator can do, and nothing else.
 *
 * Use cases rather than the ports behind them: a surface that held `SchemaAdmin`
 * or `UserAdmin` would be free to invent its own rules for what an answer means,
 * and the CLI, the studio and MCP each did.
 */
export type Operator = {
  provision: ProvisionStack;
  teardown: TeardownStack;
  mintToken: MintToken;
  changeSchema: ChangeSchema;
  schema: InspectSchema;
  storage: ManageStorage;
  backups: ManageBackups;
  users: ManageUsers;
  /** Closes every adapter this built. One call, so none of them can be forgotten. */
  close(): Promise<void>;
};

export async function createOperator(config: OperatorConfig): Promise<Operator> {
  // Before anything that reaches the network. This one rejects a secret that is
  // too short, and finding that out after waiting on an SSH handshake to a
  // server - or instead of finding it out, because the server error came first -
  // is the wrong way round for a check this cheap.
  const signer = new JwtTokenSigner(config.jwtSecret);
  const store = new FileStackStateStore(config.statePath);
  const database = await databaseEndpoint(config, store);
  const admin = new PostgresSchemaAdmin(database);
  const storage = new PostgresStorageAdmin(database);
  const backups = new PostgresBackupAdmin(database);
  const users = new PostgresUserAdmin(database);
  const { cloud, runtime, healthTimeoutMs } = machineryFor(config);

  return {
    provision: new ProvisionStack({
      cloud,
      runtime,
      store,
      clock: new SystemClock(),
      httpPort: config.httpPort,
      projectName: config.projectName,
      ...(healthTimeoutMs === undefined ? {} : { healthTimeoutMs }),
    }),
    teardown: new TeardownStack({ cloud, runtime, store }),
    mintToken: new MintToken({
      signer,
      callerRole: config.stack.callerRole,
      defaultTtlSeconds: config.accessTtlSeconds,
    }),
    changeSchema: new ChangeSchema({ admin }),
    schema: new InspectSchema({ admin }),
    storage: new ManageStorage({ storage }),
    backups: new ManageBackups({ backups }),
    users: new ManageUsers({ users }),
    async close() {
      await Promise.all([admin.close(), storage.close(), backups.close(), users.close()]);
    },
  };
}

/**
 * What creates and runs the stack. Everything else is the same whether the
 * database is on this machine or on the operator's server.
 */
function machineryFor(config: OperatorConfig): {
  cloud: CloudProvider;
  runtime: StackRuntime;
  /** A server has to boot first, so it is given longer to answer. */
  healthTimeoutMs?: number;
} {
  if (config.target === "local") {
    return {
      cloud: new DockerHostCloudProvider(),
      runtime: new DockerComposeRuntime({
        stackDir: config.stackDir,
        envFile: config.envFile,
        projectName: config.projectName,
        projectRoot: config.projectRoot,
      }),
    };
  }
  return {
    cloud: new HetznerCloudProvider({
      sourceDir: config.infraSourceDir,
      workDir: config.infraWorkDir,
      token: config.hcloudToken,
      dnsToken: config.hetznerDnsToken,
      dnsZone: config.hetznerDnsZone,
      sshKeyName: config.sshKeyName,
      location: config.serverLocation,
      stackName: config.stack.name,
      hostname: config.stack.hostname,
    }),
    runtime: new RemoteComposeRuntime({
      stackDir: config.stackDir,
      envFile: config.envFile,
      remoteDir: "/opt/baseplate",
      projectName: config.projectName,
      sshUser: "root",
    }),
    healthTimeoutMs: 300_000,
  };
}
