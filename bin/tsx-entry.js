import { createRequire } from "node:module";

/**
 * Where tsx actually is.
 *
 * It used to be resolved as `../node_modules/tsx/dist/cli.mjs`, which is only
 * true in this checkout. npm hoists dependencies, so on a real install tsx sits
 * in the consumer's top-level node_modules and that path does not exist: every
 * command died with MODULE_NOT_FOUND before it printed a thing.
 *
 * Asking Node to resolve it by name works wherever it was put.
 */
export function tsxCli() {
  const require = createRequire(import.meta.url);
  for (const id of ["tsx/cli", "tsx/dist/cli.mjs"]) {
    try {
      return require.resolve(id);
    } catch {
      // Try the next one. Older and newer tsx expose different entry points.
    }
  }
  throw new Error(
    "Baseplate could not find tsx, which it needs to run. Reinstall @diepen/baseplate.",
  );
}
