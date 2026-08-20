import { DomainError } from "./errors.ts";

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const MAX_KEY_LENGTH = 1024;

/**
 * A place for objects, made by the operator like a table is.
 *
 * `private` means only the caller who put an object there can see it.
 * `public` means anyone holding a token may read it, and still only its owner
 * may write over it or remove it.
 */
export type BucketVisibility = "private" | "public";

export type Bucket = {
  readonly name: string;
  readonly visibility: BucketVisibility;
};

export function createBucket(name: string, visibility: BucketVisibility = "private"): Bucket {
  if (!NAME_RE.test(name)) {
    throw new DomainError(
      "bucket.invalid_name",
      "A bucket name is lowercase letters, digits, and dashes, starting with a letter.",
    );
  }
  return { name, visibility };
}

export function isBucketVisibility(value: string): value is BucketVisibility {
  return value === "private" || value === "public";
}

/**
 * A key is a name inside a bucket, not a path on a disk. It never climbs out of
 * one, because the blob store puts the bucket in front of it and `..` there
 * would reach into another bucket.
 */
export function parseObjectKey(raw: string): string {
  const key = raw.trim();
  if (key.length === 0) {
    throw new DomainError("object.key_required", "An object needs a key.");
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new DomainError(
      "object.key_too_long",
      `An object key is at most ${MAX_KEY_LENGTH} characters.`,
    );
  }
  if (key.startsWith("/") || key.endsWith("/") || key.includes("//")) {
    throw new DomainError(
      "object.invalid_key",
      "An object key cannot start or end with a slash, or contain an empty segment.",
    );
  }
  if (key.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new DomainError("object.invalid_key", "An object key cannot contain '.' or '..'.");
  }
  // eslint-disable-next-line no-control-regex -- that is exactly what is refused here.
  if (/[\u0000-\u001f\u007f]/.test(key)) {
    throw new DomainError("object.invalid_key", "An object key cannot contain control characters.");
  }
  return key;
}
