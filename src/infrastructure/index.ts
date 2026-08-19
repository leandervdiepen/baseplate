import {
  ApplyMigrations,
  ChangeSchema,
  MintToken,
  ProvisionStack,
  TeardownStack,
} from "#application";
import type { Stack } from "#domain";
import { SystemClock } from "./clock/index.ts";
import { DockerComposeRuntime, DockerHostCloudProvider } from "./docker/index.ts";
import {
  FileMigrationWriter,
  FileSchemaStore,
  FileStackStateStore,
} from "./fs/index.ts";
import { HetznerCloudProvider } from "./hetzner/index.ts";
import { JwtTokenSigner } from "./jwt/index.ts";
import { RemoteComposeRuntime } from "./ssh/index.ts";

export { SystemClock } from "./clock/index.ts";
export { DockerComposeRuntime, DockerHostCloudProvider } from "./docker/index.ts";
export {
  FileMigrationWriter,
  FileSchemaStore,
  FileStackStateStore,
} from "./fs/index.ts";
export { HetznerCloudProvider } from "./hetzner/index.ts";
export { JwtTokenSigner } from "./jwt/index.ts";
export {
  MemoryClock,
  MemoryCloudProvider,
  MemoryMigrationWriter,
  MemorySchemaStore,
  MemoryStackRuntime,
  MemoryStackStateStore,
  MemoryTokenSigner,
} from "./memory/index.ts";
export { RemoteComposeRuntime } from "./ssh/index.ts";

export type OperatorTarget = "local" | "hetzner";

export type OperatorConfig = {
  target: OperatorTarget;
  jwtSecret: string;
  stack: Stack;
  stackDir: string;
  stackFile: string;
  migrationsDir: string;
  envFile: string;
  statePath: string;
  httpPort: number;
  infraDir: string;
  hcloudToken: string;
  hetznerDnsToken: string;
  hetznerDnsZone: string;
  sshKeyName: string;
  serverLocation: string;
};

export type Operator = {
  provision: ProvisionStack;
  teardown: TeardownStack;
  mintToken: MintToken;
  changeSchema: ChangeSchema;
  applyMigrations: ApplyMigrations;
};

export function createOperator(config: OperatorConfig): Operator {
  const signer = new JwtTokenSigner(config.jwtSecret);
  const store = new FileStackStateStore(config.statePath);
  const clock = new SystemClock();
  const mintToken = new MintToken({
    signer,
    callerRole: config.stack.callerRole,
  });
  const schema = new FileSchemaStore(config.stackFile);
  const migrations = new FileMigrationWriter(config.migrationsDir);

  if (config.target === "local") {
    const cloud = new DockerHostCloudProvider();
    const runtime = new DockerComposeRuntime({
      stackDir: config.stackDir,
      envFile: config.envFile,
      projectName: "baseplate",
    });
    return {
      provision: new ProvisionStack({
        cloud,
        runtime,
        store,
        clock,
        httpPort: config.httpPort,
      }),
      teardown: new TeardownStack({ cloud, runtime, store }),
      mintToken,
      changeSchema: new ChangeSchema({ schema, migrations, runtime, store }),
      applyMigrations: new ApplyMigrations({ runtime, store }),
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
    sshUser: "root",
  });
  return {
    provision: new ProvisionStack({
      cloud,
      runtime,
      store,
      clock,
      httpPort: config.httpPort,
      healthTimeoutMs: 300_000,
    }),
    teardown: new TeardownStack({ cloud, runtime, store }),
    mintToken,
    changeSchema: new ChangeSchema({ schema, migrations, runtime, store }),
    applyMigrations: new ApplyMigrations({ runtime, store }),
  };
}
