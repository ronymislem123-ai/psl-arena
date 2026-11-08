/** Path prefix of the static browser edition (e.g. "/psl-arena" on GitHub Pages); empty for the server app. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes a root-relative asset path that does not go through next/link (fetch, img, worker URLs). */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** True in the browser edition built with `npm run build:static`. */
export const IS_STATIC = process.env.NEXT_PUBLIC_PSL_STATIC === "1";
