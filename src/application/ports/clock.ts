export type Clock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};
