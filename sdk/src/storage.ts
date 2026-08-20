import { request, type QueryResult, type RequestState } from "./request.ts";

export type StoredObject = {
  bucket: string;
  key: string;
  bytes: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
};

export type ListOptions = {
  prefix?: string;
  limit?: number;
  offset?: number;
};

export type BucketClient = {
  /** Puts bytes at a key. The key is taken by whoever gets there first. */
  upload(key: string, body: Blob | ArrayBuffer | string, contentType?: string): Promise<QueryResult<StoredObject>>;
  download(key: string): Promise<QueryResult<Blob>>;
  list(options?: ListOptions): Promise<QueryResult<StoredObject[]>>;
  remove(key: string): Promise<QueryResult<null>>;
  /**
   * A URL a browser will follow on its own, for `<img src>` and downloads,
   * where an Authorization header cannot go. Expires, and covers one object.
   */
  createSignedUrl(key: string, expiresIn?: number): Promise<QueryResult<string>>;
};

export type StorageClient = {
  from(bucket: string): BucketClient;
};

/**
 * Objects are rows with bytes attached: the database decides who sees one,
 * exactly as it does for a table. Nothing here filters.
 */
export function createStorage(state: RequestState): StorageClient {
  return {
    from(bucket: string): BucketClient {
      const path = (key: string) => `/storage/${encode(bucket)}/${encode(key)}`;
      return {
        async upload(key, body, contentType) {
          const type =
            contentType ??
            (body instanceof Blob && body.type ? body.type : "application/octet-stream");
          const result = await request<{ object: StoredObject }>(state, path(key), {
            method: "PUT",
            headers: { "content-type": type },
            body: body as BodyInit,
          });
          return {
            data: result.data?.object ?? null,
            error: result.error,
            status: result.status,
          };
        },

        async download(key) {
          const token = state.authorize ? await state.authorize() : state.token;
          try {
            const response = await fetch(`${state.url}${path(key)}`, {
              headers: token ? { authorization: `Bearer ${token}` } : {},
            });
            if (!response.ok) {
              return { data: null, error: new Error(await message(response)), status: response.status };
            }
            return { data: await response.blob(), error: null, status: response.status };
          } catch (cause) {
            return {
              data: null,
              error: new Error(`Could not reach ${state.url}.`, { cause }),
              status: 0,
            };
          }
        },

        async list(options = {}) {
          const query = new URLSearchParams();
          if (options.prefix) {
            query.set("prefix", options.prefix);
          }
          if (options.limit !== undefined) {
            query.set("limit", String(options.limit));
          }
          if (options.offset !== undefined) {
            query.set("offset", String(options.offset));
          }
          const suffix = query.size > 0 ? `?${query.toString()}` : "";
          const result = await request<{ objects: StoredObject[] }>(
            state,
            `/storage/${encode(bucket)}${suffix}`,
            { method: "GET" },
          );
          return {
            data: result.data?.objects ?? null,
            error: result.error,
            status: result.status,
          };
        },

        remove(key) {
          return request<null>(state, path(key), { method: "DELETE" });
        },

        async createSignedUrl(key, expiresIn = 3600) {
          const result = await request<{ token: string }>(
            state,
            `${path(key)}?expiresIn=${String(expiresIn)}`,
            { method: "PATCH" },
          );
          if (!result.data) {
            return { data: null, error: result.error, status: result.status };
          }
          return {
            data: `${state.url}${path(key)}?token=${encodeURIComponent(result.data.token)}`,
            error: null,
            status: result.status,
          };
        },
      };
    },
  };
}

/** Slashes in a key are structure, not characters to escape. */
function encode(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

async function message(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
