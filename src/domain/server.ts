export type ServerStatus = "pending" | "running";

export type Server = {
  readonly id: string;
  readonly ipv4: string;
  readonly status: ServerStatus;
};

export function createServer(
  id: string,
  ipv4: string,
  status: ServerStatus,
): Server {
  return { id, ipv4, status };
}
