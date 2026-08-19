export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Replaced by whatever `baseplate types` prints for your database:
 *
 *   npx @diepen/baseplate types > src/database.ts
 *
 * Until then `from()` accepts any table name and returns loosely typed rows.
 */
export type Database = Record<
  string,
  { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
>;

export type TableName<DB> = Extract<keyof DB, string>;

export type TableRow<DB, T extends TableName<DB>> = DB[T] extends { Row: infer R }
  ? R
  : never;

export type TableInsert<DB, T extends TableName<DB>> = DB[T] extends { Insert: infer I }
  ? I
  : never;

export type TableUpdate<DB, T extends TableName<DB>> = DB[T] extends { Update: infer U }
  ? U
  : never;
