import { createServer } from "node:http";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { OPERATOR_HTTP_PORT } from "../operator-setup.ts";
import { packageRootFrom, projectRoot } from "../paths.ts";
import { handleOperatorRequest } from "./handle-request.ts";
import { isLocalhostHost, isLoopbackAddress } from "./localhost.ts";

const PACKAGE_ROOT = packageRootFrom(import.meta.dirname);
const PROJECT_ROOT = projectRoot();

async function main(): Promise<void> {
  const vite = await createViteServer({
    configFile: resolve(PACKAGE_ROOT, "src/delivery/dashboard/vite.config.ts"),
    server: { middlewareMode: true, host: "127.0.0.1" },
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

  server.listen(OPERATOR_HTTP_PORT, "127.0.0.1", () => {
    console.log(`http://127.0.0.1:${OPERATOR_HTTP_PORT}`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
