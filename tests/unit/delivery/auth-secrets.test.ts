import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { ensureOperatorSecrets } from "../../../src/delivery/operator-http/write-env.ts";
import { parseEnvMap } from "../../../src/delivery/operator-http/env-file.ts";

test("ensureOperatorSecrets fills AUTH_SERVICE_PASSWORD when missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "baseplate-env-"));
  writeFileSync(
    join(dir, "operator.env"),
    "TARGET=local\nJWT_SECRET=dev-jwt-secret-must-be-at-least-32-chars\n",
  );
  ensureOperatorSecrets(dir);
  const env = parseEnvMap(readFileSync(join(dir, "operator.env"), "utf8"));
  expect(env.AUTH_SERVICE_PASSWORD?.length).toBeGreaterThan(10);
});
