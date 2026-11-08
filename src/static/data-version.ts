/** Change counter for the local database: pages re-read their data when it moves. */
let version = 0;
const listeners = new Set<() => void>();

export function bumpDataVersion() {
  version++;
  for (const l of listeners) l();
}

export function subscribeDataVersion(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDataVersion(): number {
  return version;
}
