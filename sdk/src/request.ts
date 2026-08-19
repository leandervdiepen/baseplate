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
};

export async function request<T>(
  state: RequestState,
  path: string,
  init: RequestInit,
): Promise<QueryResult<T>> {
  const headers = new Headers(init.headers);
  const token = state.authorize ? await state.authorize() : state.token;
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(`${state.url}${path}`, { ...init, headers });
  } catch (cause) {
    return {
      data: null,
      error: new Error(`Could not reach ${state.url}.`, { cause }),
      status: 0,
    };
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

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; hint?: string };
    return body.hint ? `${body.message ?? ""} (${body.hint})` : body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
