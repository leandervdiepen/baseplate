import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * AES-256-GCM on a file, so a backup is never sized by how much RAM the machine
 * has. Layout is a 12 byte nonce, the ciphertext, then the 16 byte tag: GCM
 * produces the tag last, and decryption seeks to it first.
 */
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export type Sealed = {
  bytes: number;
  /** Of the sealed file, so a round trip through a bucket can be checked. */
  sha256: string;
};

/**
 * The key an operator keeps in their own baseplate.env. A passphrase is hashed
 * rather than refused, so a hand-typed key still gives 32 bytes.
 */
export function backupKey(raw: string): Buffer {
  if (raw.length < 16) {
    throw new Error("BACKUP_KEY must be at least 16 characters.");
  }
  const decoded = Buffer.from(raw, "base64url");
  if (decoded.length === 32) {
    return decoded;
  }
  return createHash("sha256").update(raw).digest();
}

export async function sealFile(key: Buffer, source: string, target: string): Promise<Sealed> {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const digest = createHash("sha256");
  const out = createWriteStream(target);

  digest.update(nonce);
  out.write(nonce);
  await pipeline(createReadStream(source), cipher, async function* (chunks) {
    for await (const chunk of chunks) {
      digest.update(chunk as Buffer);
      yield chunk;
    }
  }, out, { end: false });

  const tag = cipher.getAuthTag();
  digest.update(tag);
  await new Promise<void>((resolve, reject) => {
    out.end(tag, () => resolve());
    out.on("error", reject);
  });

  return { bytes: (await stat(target)).size, sha256: digest.digest("hex") };
}

/** Throws if the file was altered by so much as a byte: that is what GCM is for. */
export async function openFile(key: Buffer, source: string, target: string): Promise<void> {
  const size = (await stat(source)).size;
  if (size < NONCE_BYTES + TAG_BYTES) {
    throw new Error("That backup is too small to be one.");
  }
  const handle = await open(source, "r");
  try {
    const nonce = Buffer.alloc(NONCE_BYTES);
    await handle.read(nonce, 0, NONCE_BYTES, 0);
    const tag = Buffer.alloc(TAG_BYTES);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);

    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(tag);
    // A database with nothing in it still seals, and a byte range of nothing is
    // not a range, so feed the decipher an empty stream and let it check the tag.
    const sealed = size - NONCE_BYTES - TAG_BYTES;
    const input =
      sealed > 0
        ? createReadStream(source, { start: NONCE_BYTES, end: size - TAG_BYTES - 1 })
        : Readable.from([]);
    await pipeline(input, decipher, createWriteStream(target));
  } finally {
    await handle.close();
  }
}
