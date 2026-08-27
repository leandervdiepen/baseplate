import { createHash, createHmac } from "node:crypto";

/**
 * Just enough S3 to put, get, delete and list, signed with SigV4. Written here
 * rather than pulled in: every byte an operator stores passes through it, and
 * the whole of it is one hash and four HMACs, checked against AWS's examples.
 */
export type S3Config = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
};

export type S3Object = {
  key: string;
  size: number;
  etag: string;
  /** Milliseconds since the epoch, or undefined if the store did not say. */
  lastModified: number | undefined;
};

const UNSIGNED = "UNSIGNED-PAYLOAD";
const SERVICE = "s3";

export class S3Error extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`S3 answered ${status}: ${body.slice(0, 200)}`);
    this.name = "S3Error";
  }
}

export function createS3(config: S3Config) {
  const base = config.endpoint.replace(/\/$/, "");

  async function send(
    method: string,
    key: string,
    init: { body?: BodyInit | null; query?: Record<string, string>; headers?: Record<string, string> } = {},
  ): Promise<Response> {
    const url = new URL(`${base}/${config.bucket}${key ? `/${encodeKey(key)}` : ""}`);
    for (const [name, value] of Object.entries(init.query ?? {})) {
      url.searchParams.set(name, value);
    }
    const headers = signRequest({
      method,
      url,
      headers: { ...init.headers },
      config,
      now: new Date(),
    });
    const response = await fetch(url, {
      method,
      headers,
      ...(init.body === undefined ? {} : { body: init.body }),
      // Node needs telling before it will stream a request body rather than buffer it.
      ...(init.body instanceof ReadableStream ? { duplex: "half" } : {}),
    } as RequestInit);
    return response;
  }

  return {
    /**
     * Making the bucket is the service's own job at start: the blob store is an
     * implementation detail behind it, so nothing else should have to know the
     * bucket exists, let alone create it.
     */
    async ensureBucket(): Promise<void> {
      const response = await send("PUT", "");
      // Already there is the state we wanted, whichever way the store says it.
      if (response.ok || response.status === 409) {
        return;
      }
      const body = await response.text();
      if (body.includes("BucketAlreadyOwnedByYou") || body.includes("BucketAlreadyExists")) {
        return;
      }
      throw new S3Error(response.status, body);
    },

    async put(key: string, body: BodyInit, contentType: string): Promise<void> {
      const response = await send("PUT", key, {
        body,
        headers: { "content-type": contentType },
      });
      if (!response.ok) {
        throw new S3Error(response.status, await response.text());
      }
    },

    /** The response body is the object, streamed. 404 comes back as undefined. */
    async get(key: string): Promise<Response | undefined> {
      const response = await send("GET", key);
      if (response.status === 404) {
        return undefined;
      }
      if (!response.ok) {
        throw new S3Error(response.status, await response.text());
      }
      return response;
    },

    async delete(key: string): Promise<void> {
      const response = await send("DELETE", key);
      // Deleting something that is not there is the state the caller wanted.
      if (!response.ok && response.status !== 404) {
        throw new S3Error(response.status, await response.text());
      }
    },

    async list(prefix: string): Promise<S3Object[]> {
      const found: S3Object[] = [];
      let token: string | undefined;
      do {
        const response = await send("GET", "", {
          query: {
            "list-type": "2",
            prefix,
            "max-keys": "1000",
            ...(token ? { "continuation-token": token } : {}),
          },
        });
        if (!response.ok) {
          throw new S3Error(response.status, await response.text());
        }
        const xml = await response.text();
        found.push(...parseListing(xml));
        token = tag(xml, "NextContinuationToken");
      } while (token);
      return found;
    },
  };
}

/** S3 wants each path segment encoded, but the slashes between them left alone. */
export function encodeKey(key: string): string {
  return key.split("/").map(strictEncode).join("/");
}

export type SignInput = {
  method: string;
  url: URL;
  headers: Record<string, string>;
  config: Pick<S3Config, "region" | "accessKey" | "secretKey">;
  now: Date;
  /**
   * Defaults to UNSIGNED-PAYLOAD, which is what lets a body be streamed rather
   * than buffered to hash it. Pass a real hash where one is known.
   */
  payloadHash?: string;
};

export function signRequest(input: SignInput): Record<string, string> {
  const stamp = input.now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = stamp.slice(0, 8);
  const scope = `${date}/${input.config.region}/${SERVICE}/aws4_request`;

  const payloadHash = input.payloadHash ?? UNSIGNED;
  const headers: Record<string, string> = {
    ...input.headers,
    host: input.url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": stamp,
  };
  const names = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const canonicalHeaders = names
    .map((name) => `${name}:${collapse(headers[headerKey(headers, name)] ?? "")}\n`)
    .join("");
  const signedHeaders = names.join(";");

  const query = [...input.url.searchParams.entries()]
    .map(([name, value]): [string, string] => [strictEncode(name), strictEncode(value)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  const canonical = [
    input.method,
    input.url.pathname,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const toSign = [
    "AWS4-HMAC-SHA256",
    stamp,
    scope,
    createHash("sha256").update(canonical).digest("hex"),
  ].join("\n");

  const signature = hmac(signingKey(input.config.secretKey, date, input.config.region), toSign).toString("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${input.config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

function signingKey(secret: string, date: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), SERVICE), "aws4_request");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

/** Encodes what AWS's canonical form wants, which is not what encodeURIComponent does. */
function strictEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function headerKey(headers: Record<string, string>, lower: string): string {
  return Object.keys(headers).find((name) => name.toLowerCase() === lower) ?? lower;
}

export function parseListing(xml: string): S3Object[] {
  const found: S3Object[] = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const block = match[1] ?? "";
    const key = tag(block, "Key");
    if (key) {
      const modified = Date.parse(tag(block, "LastModified") ?? "");
      found.push({
        key: decodeXml(key),
        size: Number(tag(block, "Size") ?? "0"),
        etag: (tag(block, "ETag") ?? "").replaceAll("&quot;", "").replaceAll('"', ""),
        lastModified: Number.isNaN(modified) ? undefined : modified,
      });
    }
  }
  return found;
}

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)?.[1];
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
