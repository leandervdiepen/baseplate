import { get, query, send } from "./http.ts";
import type { BucketList, BucketVisibility, StoredObject } from "./types.ts";

export const getBuckets = (): Promise<BucketList> => get<BucketList>("/api/storage");

export const createBucket = (name: string, visibility: BucketVisibility): Promise<BucketList> =>
  send<BucketList>("POST", "/api/storage", { name, visibility });

export const setBucketVisibility = (
  name: string,
  visibility: BucketVisibility,
): Promise<BucketList> => send<BucketList>("PATCH", "/api/storage", { name, visibility });

export const dropBucket = (name: string): Promise<BucketList> =>
  send<BucketList>("DELETE", `/api/storage?${query({ bucket: name })}`);

export const getBucketObjects = async (bucket: string): Promise<StoredObject[]> =>
  (await get<{ objects: StoredObject[] }>(`/api/storage/objects?${query({ bucket })}`)).objects;
