import { useEffect, useState } from "react";
import { getBucketObjects, type StoredObject } from "../lib/operator-client.ts";
import { formatBytes, shortId } from "../lib/format.ts";
import { DataCell, DataRow, DataTable } from "../patterns/data-table.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";

/**
 * Every object in the bucket, whoever owns it. This is the operator's view, not
 * a caller's: an app only ever sees its own, which is the whole point.
 */
export function BucketObjects({ bucket, apiUp }: { bucket: string; apiUp: boolean }) {
  const [objects, setObjects] = useState<StoredObject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setObjects(null);
    setError(null);
    void getBucketObjects(bucket)
      .then(setObjects)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to read this bucket.");
        setObjects([]);
      });
  }, [bucket]);

  if (!apiUp) {
    return (
      <p className="mt-[var(--space-md)] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        The stack is not running, so there is nothing to read.
      </p>
    );
  }

  return (
    <div className="mt-[var(--space-md)]">
      <StatusMessage message={error} tone="error" className="mb-2 block" />
      {objects && objects.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          Nothing in this bucket yet.
        </p>
      ) : null}
      {objects && objects.length > 0 ? (
        <DataTable
          caption={`Objects in ${bucket}`}
          columns={[
            { key: "key", label: "Key" },
            { key: "size", label: "Size", width: "6rem" },
            { key: "type", label: "Type", width: "10rem" },
            { key: "owner", label: "Owner", width: "8rem" },
            { key: "created", label: "Created", width: "12rem" },
          ]}
        >
          {objects.map((object) => (
            <DataRow key={object.key}>
              <DataCell mono>{object.key}</DataCell>
              <DataCell mono width="6rem">
                {formatBytes(object.bytes)}
              </DataCell>
              <DataCell muted width="10rem">
                {object.contentType}
              </DataCell>
              <DataCell mono muted width="8rem">
                <span title={object.ownerId}>{shortId(object.ownerId)}</span>
              </DataCell>
              <DataCell mono muted width="12rem">
                {new Date(object.createdAt).toLocaleString()}
              </DataCell>
            </DataRow>
          ))}
        </DataTable>
      ) : null}
    </div>
  );
}
