import { ChangeSchema, MintToken, ProvisionStack, TeardownStack } from "#application";
import type { BackupAdmin, SchemaAdmin, StorageAdmin, UserAdmin } from "#application";
import type { Stack } from "#domain";
import { SystemClock } from "./clock/index.ts";
import { DockerComposeRuntime, DockerHostCloudProvider } from "./docker/index.ts";
import { FileStackStateStore } from "./fs/index.ts";
import { HetznerCloudProvider } from "./hetzner/index.ts";
import { JwtTokenSigner } from "./jwt/index.ts";
import {
  PostgresBackupAdmin,
  PostgresSchemaAdmin,
  PostgresStorageAdmin,
  PostgresUserAdmin,
} from "./postgres/index.ts";
import { RemoteComposeRuntime } from "./ssh/index.ts";

export { SystemClock } from "./clock/index.ts";
export { assertPassword, hashPassword } from "./crypto/index.ts";
export {
  DockerComposeRuntime,
  DockerHostCloudProvider,
  parseRunningStacks,
  runningStacks,
} from "./docker/index.ts";
export { FileProjectDirectory, FileStackStateStore } from "./fs/index.ts";
export { HetznerAccount, HetznerCloudProvider } from "./hetzner/index.ts";
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
export { RemoteComposeRuntime } from "./ssh/index.ts";

export type OperatorTarget = "local" | "hetzner";

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
  infraDir: string;
  hcloudToken: string;
  hetznerDnsToken: string;
  hetznerDnsZone: string;
  sshKeyName: string;
  serverLocation: string;
  /** What a minted caller token is good for, from ACCESS_TOKEN_TTL. */
  accessTtlSeconds: number;
};

export type Operator = {
  provision: ProvisionStack;
  teardown: TeardownStack;
  mintToken: MintToken;
  changeSchema: ChangeSchema;
  admin: SchemaAdmin;
  storage: StorageAdmin;
  backups: BackupAdmin;
  users: UserAdmin;
};

export function createOperator(config: OperatorConfig): Operator {
  const signer = new JwtTokenSigner(config.jwtSecret);
  const store = new FileStackStateStore(config.statePath);
  const clock = new SystemClock();
  const mintToken = new MintToken({
    signer,
    callerRole: config.stack.callerRole,
    defaultTtlSeconds: config.accessTtlSeconds,
  });
  const database = {
    host: "127.0.0.1",
    port: config.postgresPort,
    database: config.stack.databaseName,
    password: config.postgresPassword,
  };
  const admin = new PostgresSchemaAdmin(database);
  const storage = new PostgresStorageAdmin(database);
  const backups = new PostgresBackupAdmin(database);
  const users = new PostgresUserAdmin(database);

  if (config.target === "local") {
    const cloud = new DockerHostCloudProvider();
    const runtime = new DockerComposeRuntime({
      stackDir: config.stackDir,
      envFile: config.envFile,
      projectName: config.projectName,
      projectRoot: config.projectRoot,
    });
    return {
      provision: new ProvisionStack({
        cloud,
        runtime,
        store,
        clock,
        httpPort: config.httpPort,
        projectName: config.projectName,
      }),
      teardown: new TeardownStack({ cloud, runtime, store }),
      mintToken,
      changeSchema: new ChangeSchema({ admin }),
      admin,
      storage,
      backups,
      users,
    };
  }

  const cloud = new HetznerCloudProvider({
    infraDir: config.infraDir,
    token: config.hcloudToken,
    dnsToken: config.hetznerDnsToken,
    dnsZone: config.hetznerDnsZone,
    sshKeyName: config.sshKeyName,
    location: config.serverLocation,
    stackName: config.stack.name,
    hostname: config.stack.hostname,
  });
  const runtime = new RemoteComposeRuntime({
    stackDir: config.stackDir,
    envFile: config.envFile,
    remoteDir: "/opt/baseplate",
    projectName: config.projectName,
    sshUser: "root",
  });
  return {
    provision: new ProvisionStack({
      cloud,
      runtime,
      store,
      clock,
      httpPort: config.httpPort,
      projectName: config.projectName,
      healthTimeoutMs: 300_000,
    }),
    teardown: new TeardownStack({ cloud, runtime, store }),
    mintToken,
    changeSchema: new ChangeSchema({ admin }),
    admin,
    storage,
    backups,
    users,
  };
}
