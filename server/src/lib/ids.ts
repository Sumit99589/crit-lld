import { createHash, randomUUID } from "node:crypto";

export type IdGenerator = () => string;

export const uuid: IdGenerator = () => randomUUID();

export function sha256(...parts: string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\u0000");
  return hash.digest("hex");
}
