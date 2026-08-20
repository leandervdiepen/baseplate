import { useEffect, useState } from "react";
import { client } from "../client.ts";

const BUCKET = "card-files";

type Attachment = { key: string; bytes: number };

/**
 * Files on a card. The key carries the card id, which keeps one card's files
 * together, but it is not what keeps them private: the bucket is private, so a
 * caller only ever sees the objects they put there. Guessing a key gets a 404.
 */
export function Attachments({ cardId, onError }: { cardId: string; onError: (m: string) => void }) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const prefix = `cards/${cardId}/`;

  useEffect(() => {
    void refresh();
    // The card is the only thing this depends on.
  }, [cardId]);

  async function refresh(): Promise<void> {
    const { data, error } = await client.storage.from(BUCKET).list({ prefix });
    if (error) {
      onError(error.message);
      return;
    }
    setFiles((data ?? []).map((object) => ({ key: object.key, bytes: object.bytes })));
  }

  async function upload(file: File): Promise<void> {
    setBusy(true);
    const { error } = await client.storage.from(BUCKET).upload(`${prefix}${file.name}`, file);
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    await refresh();
  }

  /** A link a browser will follow on its own, since it cannot send a header. */
  async function open(key: string): Promise<void> {
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(key, 300);
    if (error || !data) {
      onError(error?.message ?? "Could not make a link for that file.");
      return;
    }
    window.open(data, "_blank", "noopener");
  }

  async function remove(key: string): Promise<void> {
    const { error } = await client.storage.from(BUCKET).remove(key);
    if (error) {
      onError(error.message);
      return;
    }
    await refresh();
  }

  return (
    <div className="files">
      {files.map((file) => (
        <span key={file.key} className="file">
          <button className="link" type="button" onClick={() => void open(file.key)}>
            {file.key.slice(prefix.length)}
          </button>
          <button
            className="button ghost"
            type="button"
            aria-label={`Remove ${file.key.slice(prefix.length)}`}
            onClick={() => void remove(file.key)}
          >
            ×
          </button>
        </span>
      ))}
      <label className="attach">
        {busy ? "Uploading…" : "Attach a file"}
        <input
          type="file"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void upload(file);
            }
          }}
        />
      </label>
    </div>
  );
}
