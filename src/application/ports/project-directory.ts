/** A project this operator has opened before, wherever it lives on disk. */
export type KnownProject = {
  /** Absolute path to the directory holding `baseplate.env`. */
  root: string;
  /** What to call it. The directory's own name. */
  name: string;
  /** When the studio last served it, so the list can lead with the recent. */
  lastOpenedAt: string;
};

/**
 * The projects on this machine. Baseplate has no account and no server to ask,
 * so the list is whatever this operator has opened, kept beside their own
 * config rather than inside any one project: a project cannot be the authority
 * on which other projects exist.
 */
export type ProjectDirectory = {
  list(): Promise<readonly KnownProject[]>;
  /** Idempotent. Opening a project again only moves it up the list. */
  remember(root: string): Promise<void>;
  forget(root: string): Promise<void>;
};
