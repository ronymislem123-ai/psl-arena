import { Fragment } from "react";

/**
 * Text for uppercase table headers: CSS `uppercase` would turn σ/λ into Σ/Λ (a
 * different quantity), so Greek letters are kept in their own lowercase span.
 */
export function KeepGreek({ text }: { text: string }) {
  const parts = text.split(/([σλμ])/);
  return (
    <>
      {parts.map((p, i) => (/^[σλμ]$/.test(p) ? <span key={i} className="normal-case">{p}</span> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}
