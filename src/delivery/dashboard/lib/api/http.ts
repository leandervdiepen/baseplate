/**
 * One way to talk to operator HTTP. Every call went through the same four
 * lines: fetch, check `ok`, parse the error body, cast the good one. Those
 * lines live here once, so an endpoint below is the URL and the shape it
 * returns, and nothing else.
 */

/**
 * Operator HTTP answers with the same stable code the CLI prints. Keeping it on
 * the error lets a screen offer the way out instead of only naming the problem.
 */
export class OperatorError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OperatorError";
  }
}

async function failure(response: Response): Promise<OperatorError> {
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    return new OperatorError(body.code ?? "operator.failed", body.message ?? response.statusText);
  } catch {
    return new OperatorError("operator.failed", response.statusText);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw await failure(response);
  }
  return (await response.json()) as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

/**
 * `application/json` is deliberate rather than incidental: operator HTTP
 * refuses any other content type, which is what stops a page you happened to
 * visit from posting to the studio behind your back.
 */
export function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export const post = <T>(path: string, body?: unknown): Promise<T> => send<T>("POST", path, body);

/** Nothing comes back but a status, so the return is discarded on purpose. */
export async function postNothing(path: string, body?: unknown): Promise<void> {
  await send<unknown>("POST", path, body);
}

export function query(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}
