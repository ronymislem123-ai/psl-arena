"use client";
/**
 * Browser page translation (Chrome/Edge "Translate this page", also extensions such
 * as grammar checkers) replaces text nodes behind React's back. The next update
 * then fails with "Failed to execute 'removeChild' on 'Node'" and the page crashes
 * (facebook/react#11538). The app ships its own German translation and marks the
 * document as not translatable; this guard is the fallback for forced translations:
 * React's DOM operations on nodes that a third party already moved are skipped
 * instead of throwing. Installed once, on the client, before the first render.
 */
let installed = false;

export function installDomGuard() {
  if (installed || typeof window === "undefined" || typeof Node !== "function") return;
  installed = true;
  const proto = Node.prototype;
  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn("[dom-guard] skipped removeChild of a node moved by another script (page translation?)");
      return child;
    }
    return removeChild.call(this, child) as T;
  };
  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      console.warn("[dom-guard] insertBefore with a reference node moved by another script (page translation?) — appending instead");
      return insertBefore.call(this, node, null) as T;
    }
    return insertBefore.call(this, node, ref) as T;
  };
}

installDomGuard();
