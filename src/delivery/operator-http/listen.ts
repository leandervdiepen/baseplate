import { createServer } from "node:http";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { dashboardPortFor } from "../operator-setup.ts";
import { packageRootFrom, projectRoot } from "../paths.ts";
import { handleOperatorRequest } from "./handle-request.ts";
import { isLocalhostHost, isLoopbackAddress } from "./localhost.ts";

const PACKAGE_ROOT = packageRootFrom(import.meta.dirname);
const PROJECT_ROOT = projectRoot();
// `--port` beats the project's config, which beats the default.
const PORT = Number(process.env.BASEPLATE_DASHBOARD_PORT) || dashboardPortFor(PROJECT_ROOT);

/**
 * Vite's hot-reload socket needs a port of its own, and it too would be shared
 * by every project. Ten thousand above the studio keeps it in a band the studio
 * itself never reaches.
 */
const HMR_PORT = PORT + 10_000;

async function main(): Promise<void> {
  const vite = await createViteServer({
    configFile: resolve(PACKAGE_ROOT, "src/delivery/dashboard/vite.config.ts"),
    server: {
      middlewareMode: true,
      host: "127.0.0.1",
      hmr: { host: "127.0.0.1", port: HMR_PORT },
    },
    appType: "spa",
  });

  const server = createServer((req, res) => {
    const remote = req.socket.remoteAddress;
    if (!isLoopbackAddress(remote) || !isLocalhostHost(req.headers.host)) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          code: "operator.localhost_only",
          message: "Dashboard binds to 127.0.0.1 only.",
        }),
      );
      return;
    }
    const url = req.url ?? "/";
    if (url.startsWith("/api/")) {
      void handleOperatorRequest({ packageRoot: PACKAGE_ROOT, projectRoot: PROJECT_ROOT }, req, res);
      return;
    }
    vite.middlewares(req, res, () => {
      res.writeHead(404);
      res.end();
    });
  });

  // A port already taken is an ordinary thing that happens when a studio is
  // open twice, and it deserves a sentence rather than a stack trace.
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `operator.port_in_use: Port ${PORT} is already serving something. ` +
          `If it is this project's studio, it is already open. ` +
          `Otherwise change DASHBOARD_PORT in baseplate.env.`,
      );
      process.exit(1);
    }
    throw error;
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`http://127.0.0.1:${PORT}`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
