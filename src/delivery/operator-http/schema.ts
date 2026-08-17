export type SchemaColumn = {
  name: string;
  type: string;
  primaryKey: boolean;
  owner: boolean;
  references?: { table: string; column: string };
};

export type SchemaTableView = {
  name: string;
  ownerColumn: string;
  columns: SchemaColumn[];
};

export type SchemaSnapshot = {
  live: boolean;
  tables: SchemaTableView[];
};

export type DeclaredTable = {
  name: string;
  ownerColumn: string;
};

type OpenApiProperty = {
  type?: string;
  format?: string;
  description?: string;
};

type OpenApiSchema = {
  properties?: Record<string, OpenApiProperty>;
  required?: string[];
};

export function columnType(property: OpenApiProperty): string {
  if (property.format) {
    return property.format;
  }
  return property.type ?? "unknown";
}

export function parseReferences(description: string | undefined): { table: string; column: string } | undefined {
  if (!description) {
    return undefined;
  }
  const tagged = description.match(/<fk\s+table=['"]([^'"]+)['"]\s+column=['"]([^'"]+)['"]\s*\/>/i);
  if (tagged?.[1] && tagged[2]) {
    return { table: tagged[1], column: tagged[2] };
  }
  const prose = description.match(/Foreign Key to ([a-z_][a-z0-9_]*)[.]([a-z_][a-z0-9_]*)/i);
  if (prose?.[1] && prose[2]) {
    return { table: prose[1], column: prose[2] };
  }
  return undefined;
}

export function isPrimaryKey(description: string | undefined): boolean {
  if (!description) {
    return false;
  }
  return description.includes("<pk/>") || /primary key/i.test(description);
}

export function schemasFromOpenApi(spec: unknown): Record<string, OpenApiSchema> {
  if (!spec || typeof spec !== "object") {
    return {};
  }
  const root = spec as {
    definitions?: Record<string, OpenApiSchema>;
    components?: { schemas?: Record<string, OpenApiSchema> };
  };
  return root.definitions ?? root.components?.schemas ?? {};
}

export function mergeSchema(
  declared: readonly DeclaredTable[],
  spec: unknown | null,
): SchemaSnapshot {
  const live = spec !== null;
  const schemas = spec ? schemasFromOpenApi(spec) : {};
  return {
    live,
    tables: declared.map((table) => {
      const schema = schemas[table.name];
      const properties = schema?.properties ?? {};
      const names = Object.keys(properties);
      const columns: SchemaColumn[] =
        names.length > 0
          ? names.map((name) => {
              const property = properties[name] ?? {};
              const column: SchemaColumn = {
                name,
                type: columnType(property),
                primaryKey: isPrimaryKey(property.description) || name === "id",
                owner: name === table.ownerColumn,
              };
              const references = parseReferences(property.description);
              if (references) {
                column.references = references;
              }
              return column;
            })
          : [{ name: table.ownerColumn, type: "uuid", primaryKey: false, owner: true }];
      if (!columns.some((column) => column.owner)) {
        columns.push({
          name: table.ownerColumn,
          type: "uuid",
          primaryKey: false,
          owner: true,
        });
      }
      return { name: table.name, ownerColumn: table.ownerColumn, columns };
    }),
  };
}
