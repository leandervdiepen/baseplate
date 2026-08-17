export type AuthUser = {
  id: string;
  email: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type AuthClient = {
  signUp(input: { email: string; password: string }): Promise<AuthSession>;
  signIn(input: { email: string; password: string }): Promise<AuthSession>;
  getUser(): Promise<AuthUser>;
  getToken(): string | undefined;
};

export function createAuth(
  url: string,
  onToken: (token: string | undefined) => void,
  initialToken?: string,
): AuthClient {
  let token = initialToken;
  onToken(token);

  async function post(path: string, body: unknown): Promise<AuthSession> {
    const response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as AuthSession & { message?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? response.statusText);
    }
    token = payload.token;
    onToken(token);
    return { token: payload.token, user: payload.user };
  }

  return {
    signUp(input) {
      return post("/auth/signup", input);
    },
    signIn(input) {
      return post("/auth/login", input);
    },
    async getUser() {
      if (!token) {
        throw new Error("Sign in first.");
      }
      const response = await fetch(`${url}/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { user?: AuthUser; message?: string };
      if (!response.ok || !payload.user) {
        throw new Error(payload.message ?? response.statusText);
      }
      return payload.user;
    },
    getToken() {
      return token;
    },
  };
}
