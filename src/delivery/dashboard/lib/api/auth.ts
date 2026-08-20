import { post } from "./http.ts";
import type { AuthSession } from "./types.ts";

export const signUp = (email: string, password: string): Promise<AuthSession> =>
  post<AuthSession>("/api/auth/signup", { email, password });

export const signIn = (email: string, password: string): Promise<AuthSession> =>
  post<AuthSession>("/api/auth/login", { email, password });
