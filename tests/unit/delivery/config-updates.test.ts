import { expect, test } from "vitest";
import { configUpdates } from "../../../src/delivery/operator-http/handle-request.ts";

test("a value is written as given", () => {
  expect(configUpdates({ CORS_ORIGIN: "https://app.example.com" })).toEqual({
    CORS_ORIGIN: "https://app.example.com",
  });
});

/**
 * The field shows a placeholder rather than the stored token, so blank means
 * the operator did not retype it. Treating that as "clear it" would delete a
 * Hetzner token every time somebody changed their session lifetime.
 */
test("a secret left blank keeps whatever is stored", () => {
  expect(configUpdates({ HCLOUD_TOKEN: "", BACKUP_S3_SECRET_KEY: "" })).toEqual({});
});

/**
 * Anything else has to be clearable, or there is no way back from naming a
 * backup destination once you have named one.
 */
test("an ordinary setting left blank is cleared", () => {
  expect(configUpdates({ BACKUP_S3_BUCKET: "" })).toEqual({ BACKUP_S3_BUCKET: "" });
});

test("a key nobody put on the list is ignored", () => {
  expect(configUpdates({ JWT_SECRET: "hunter2", POSTGRES_PASSWORD: "hunter2" })).toEqual({});
});

test("a value that is not a string is not a value", () => {
  expect(configUpdates({ CORS_ORIGIN: undefined })).toEqual({});
});
