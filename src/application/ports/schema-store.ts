import type { Stack } from "#domain";

/** Reads and writes the declared stack, which is `stack/stack.json` on disk. */
export type SchemaStore = {
  read(): Promise<Stack>;
  write(stack: Stack): Promise<void>;
};
