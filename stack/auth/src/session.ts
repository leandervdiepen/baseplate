import type { AuthDb } from "./db.ts";
import {
  createRefreshToken,
  signAccessToken,
  type AuthUser,
  type TokenConfig,
} from "./token.ts";

export type Session = {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

/**
 * One place issues sessions, so signup, login, and refresh cannot drift apart
 * on lifetime or shape.
 */
export async function issueSession(
  db: AuthDb,
  config: TokenConfig,
  user: AuthUser,
): Promise<Session> {
  const token = await signAccessToken(config, user);
  const refresh = createRefreshToken();
  const expiresAt = new Date(Date.now() + config.refreshTtlSeconds * 1000);
  await db.storeRefreshToken(user.id, refresh.hash, expiresAt);
  return {
    token,
    refreshToken: refresh.value,
    expiresIn: config.accessTtlSeconds,
    user,
  };
}
