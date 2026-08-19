#!/usr/bin/env npx tsx
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const baseUrl = (process.env.BASEPLATE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const token = process.env.BASEPLATE_TOKEN;

const headers: Record<string, string> = {
  accept: "application/openapi+json, application/json",
};
if (token) {
  headers.authorization = `Bearer ${token}`;
}

const response = await fetch(`${baseUrl}/`, { headers });
if (!response.ok) {
  throw new Error(`OpenAPI fetch failed: ${response.status}`);
}
const spec = (await response.json()) as {
  definitions?: Record<string, { properties?: Record<string, { type?: string; format?: string }> }>;
};
const definitions = spec.definitions ?? {};
const tables = Object.entries(definitions).filter(([name]) => name !== "/");

if (tables.length === 0) {
  throw new Error(
    "OpenAPI had no table definitions. Set BASEPLATE_TOKEN to a caller JWT (anon cannot see tables).",
  );
}

const blocks = tables.map(([name, schema]) => {
  const properties = schema.properties ?? {};
  const fields = Object.entries(properties).map(([field, property]) => {
    const ts = property.format === "uuid" || field.endsWith("_id") || field === "id"
      ? "string"
      : property.type === "boolean"
        ? "boolean"
        : property.type === "integer" || property.type === "number"
          ? "number"
          : "string";
    return `    ${field}: ${ts};`;
  });
  const insertOptional = Object.keys(properties)
    .filter((field) => field === "id" || field.endsWith("_id"))
    .map((field) => `    ${field}?: string;`);
  const requiredInsert = Object.keys(properties)
    .filter((field) => field !== "id" && !field.endsWith("_id"))
    .map((field) => `    ${field}: string;`);
  return `export type ${pascal(name)}Row = {\n${fields.join("\n")}\n};\n\nexport type ${pascal(name)}Insert = {\n${[...requiredInsert, ...insertOptional].join("\n")}\n};\n\nexport type ${pascal(name)}Update = {\n${requiredInsert.map((line) => line.replace(":", "?:")).join("\n")}\n};`;
});

const dbFields = tables
  .map(([name]) => `  ${name}: {\n    Row: ${pascal(name)}Row;\n    Insert: ${pascal(name)}Insert;\n    Update: ${pascal(name)}Update;\n  };`)
  .join("\n");

const source = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

${blocks.join("\n\n")}

export type Database = {
${dbFields}
};

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
`;

writeFileSync(resolve(import.meta.dirname, "../src/database.ts"), source);
process.stdout.write(`wrote sdk/src/database.ts from ${baseUrl}\n`);

function pascal(name: string): string {
  return name
    .split(/[_-]/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join("");
}
