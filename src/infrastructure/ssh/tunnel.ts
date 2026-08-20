import { spawn, type ChildProcess } from "node:child_process";
import { createServer, connect } from "node:net";
import { InfraError } from "#shared";

const SSH_OPTS = [
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=10",
  "-o",
  "ExitOnForwardFailure=yes",
  "-o",
  "ServerAliveInterval=30",
];
const READY_TIMEOUT_MS = 20_000;
const READY_INTERVAL_MS = 200;

export type TunnelConfig = {
  /** The server, as SSH addresses it. */
  host: string;
  user: string;
  /** What to reach on the far side, from the server's point of view. */
  remoteHost: string;
  remotePort: number;
};

type Tunnel = { localPort: number; child: ChildProcess };

/**
 * One tunnel per destination, shared.
 *
 * The studio builds an operator per request and throws it away again, so a
 * tunnel per operator would mean an SSH handshake on every click. These outlive
 * the operators that asked for them and are torn down when the process ends.
 */
const tunnels = new Map<string, Promise<Tunnel>>();
let exitHooked = false;

/**
 * A local port that reaches `remoteHost:remotePort` on the server.
 *
 * The stack publishes Postgres on the server's loopback only, which is the
 * point: the firewall opens 22, 80 and 443 and nothing else. So the operator
 * tool reaches the database the same way it reaches everything else on that
 * machine, over the SSH access provisioning already set up.
 */
export async function openTunnel(config: TunnelConfig): Promise<number> {
  const key = `${config.user}@${config.host}:${config.remoteHost}:${String(config.remotePort)}`;
  const existing = tunnels.get(key);
  if (existing) {
    return (await existing).localPort;
  }
  const started = start(config, key);
  tunnels.set(key, started);
  try {
    return (await started).localPort;
  } catch (cause) {
    tunnels.delete(key);
    throw cause;
  }
}

/** Every tunnel this process opened. Called on the way out. */
export function closeTunnels(): void {
  for (const pending of tunnels.values()) {
    void pending.then(
      (tunnel) => tunnel.child.kill(),
      () => undefined,
    );
  }
  tunnels.clear();
}

async function start(config: TunnelConfig, key: string): Promise<Tunnel> {
  hookExit();
  const localPort = await freePort();
  const child = spawn("ssh", tunnelArgs(config, localPort), {
    stdio: ["ignore", "ignore", "pipe"],
  });
  // ssh says why it refused on stderr, and a forward that failed is the one
  // thing an operator has to be told about verbatim.
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.on("exit", () => {
    tunnels.delete(key);
  });
  child.unref();

  try {
    await waitUntilForwarding(localPort, child);
  } catch (cause) {
    child.kill();
    throw new InfraError(
      "ssh.tunnel_failed",
      `Could not reach ${config.remoteHost}:${String(config.remotePort)} on ${config.host} over SSH.` +
        (stderr.trim() ? ` ssh said: ${stderr.trim()}` : ""),
      cause,
    );
  }
  return { localPort, child };
}

/**
 * `-N` because there is no command to run, only the forward, and
 * `ExitOnForwardFailure` because an ssh that stays up with no forward is worse
 * than one that fails: connections to the local port would hang rather than
 * being refused.
 */
export function tunnelArgs(config: TunnelConfig, localPort: number): string[] {
  return [
    ...SSH_OPTS,
    "-N",
    "-L",
    `127.0.0.1:${String(localPort)}:${config.remoteHost}:${String(config.remotePort)}`,
    `${config.user}@${config.host}`,
  ];
}

/**
 * Ask the operating system for a port nobody is using, then let go of it.
 *
 * There is a gap between letting go and ssh binding it. Nothing better exists:
 * ssh cannot be asked to pick a port and then say which one it picked.
 */
function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close();
        reject(new InfraError("ssh.tunnel_port", "Could not find a free local port."));
        return;
      }
      const { port } = address;
      probe.close(() => {
        resolvePort(port);
      });
    });
  });
}

async function waitUntilForwarding(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new InfraError("ssh.tunnel_exited", "ssh exited before the tunnel was up.");
    }
    if (await accepts(port)) {
      return;
    }
    await sleep(READY_INTERVAL_MS);
  }
  throw new InfraError("ssh.tunnel_timeout", "The tunnel did not come up in time.");
}

function accepts(port: number): Promise<boolean> {
  return new Promise((resolveAccepts) => {
    const socket = connect({ host: "127.0.0.1", port });
    const done = (answer: boolean): void => {
      socket.destroy();
      resolveAccepts(answer);
    };
    socket.once("connect", () => {
      done(true);
    });
    socket.once("error", () => {
      done(false);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function hookExit(): void {
  if (exitHooked) {
    return;
  }
  exitHooked = true;
  process.once("exit", closeTunnels);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      closeTunnels();
      process.exit(130);
    });
  }
}
