export type QueryResult<T> = {
  data: T | null;
  error: Error | null;
  status: number;
};

export type RequestState = {
  url: string;
  token: string | undefined;
  /** Called before every request so an expired access token refreshes first. */
  authorize?: () => Promise<string | undefined>;
  /** Called after a 401, so a token that expired mid-flight costs one retry, not an error. */
  refresh?: () => Promise<string | undefined>;
};

export async function request<T>(
  state: RequestState,
  path: string,
  init: RequestInit,
): Promise<QueryResult<T>> {
  const token = state.authorize ? await state.authorize() : state.token;
  let attempt = await send(state, path, init, token);
  if (attempt.response?.status === 401 && state.refresh) {
    const renewed = await state.refresh();
    // Replaying with the same token would just earn the same 401.
    if (renewed && renewed !== token) {
      attempt = await send(state, path, init, renewed);
    }
  }
  const { response, error } = attempt;
  if (!response) {
    return { data: null, error, status: 0 };
  }
  if (!response.ok) {
    return { data: null, error: new Error(await readMessage(response)), status: response.status };
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return { data: null, error: null, status: response.status };
  }
  return {
    data: (await response.json()) as T,
    error: null,
    status: response.status,
  };
}

type Attempt = { response: Response; error: null } | { response: null; error: Error };

async function send(
  state: RequestState,
  path: string,
  init: RequestInit,
  token: string | undefined,
): Promise<Attempt> {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  try {
    return { response: await fetch(`${state.url}${path}`, { ...init, headers }), error: null };
  } catch (cause) {
    return { response: null, error: new Error(`Could not reach ${state.url}.`, { cause }) };
  }
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; hint?: string };
    return body.hint ? `${body.message ?? ""} (${body.hint})` : body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
