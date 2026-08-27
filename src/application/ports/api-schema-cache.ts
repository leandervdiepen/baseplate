/**
 * The API's view of the schema, which lags the database's: PostgREST rebuilds
 * its cache after the transaction commits, and in that gap an insert into a
 * table that exists is answered `404 {}`.
 */
export type ApiSchemaCache = {
  /** Waits until the API serves every one of these. Never rejects. */
  waitFor(tables: readonly string[]): Promise<void>;
};
