export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ItemsRow = {
  id: string;
  owner_id: string;
  body: string;
};

export type ItemsInsert = {
  body: string;
  id?: string;
  owner_id?: string;
};

export type ItemsUpdate = {
  body?: string;
};

export type Database = {
  items: {
    Row: ItemsRow;
    Insert: ItemsInsert;
    Update: ItemsUpdate;
  };
};

export type TableName<DB> = Extract<keyof DB, string>;

export type TableRow<DB, T extends TableName<DB>> = DB[T] extends { Row: infer R }
  ? R
  : never;

export type TableInsert<DB, T extends TableName<DB>> = DB[T] extends { Insert: infer I }
  ? I
  : never;
