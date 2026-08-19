import { createClient } from "@diepen/baseplate/client";
import type { Database } from "./database.ts";

/**
 * One client for the app. The URL is the one `baseplate up` printed; there is
 * no public key to go with it, because the API trusts the JWT a login returns.
 */
export const client = createClient<Database>(
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8090",
);
