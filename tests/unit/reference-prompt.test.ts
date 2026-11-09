import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { REFERENCE_PROMPT } from "@/lib/reference-prompt";

const SECTIONS = [
  "1. DEINE ROLLE",
  "2. ABSOLUTE IDENTITY-LOCK – NICHT VERHANDELBAR",
  "3. NEUTRALE KOPFPOSITION UND FRONTALANSICHT",
  "4. NEUTRALER WEISSER HINTERGRUND",
  "5. STÖRENDE KLEIDUNG UND ACCESSOIRES",
  "6. PROFESSIONELLE BILDQUALITÄTSOPTIMIERUNG",
  "7. OPTIMIERUNG FÜR 3D-FACIAL-LANDMARKS UND GESICHTSANALYSEN",
  "8. KAMERA, BILDAUSSCHNITT UND KOMPOSITION",
  "9. NEGATIVE INSTRUCTIONS – ABSOLUT VERBOTEN",
  "10. QUALITÄTSKONTROLLE VOR DER AUSGABE",
  "11. FINALES ZIEL",
];

describe("Universal Facial Reference prompt (verbatim original)", () => {
  it("is byte-identical to the delivered original (SHA-256 of the UTF-8 text)", () => {
    expect(createHash("sha256").update(REFERENCE_PROMPT, "utf8").digest("hex")).toBe("5197e2acf46f89623458a819c8121f34690a36a5f657d86fbfe5ee265f2b5af8");
    expect(REFERENCE_PROMPT.length).toBe(9352);
  });

  it("contains all eleven numbered sections in order, title first, closing sentence last", () => {
    const lines = REFERENCE_PROMPT.split("\n");
    expect(lines[0]).toBe("UNIVERSAL FACIAL REFERENCE IMAGE – IDENTITY-LOCKED OPTIMIZATION");
    let last = -1;
    for (const s of SECTIONS) {
      const i = lines.indexOf(s);
      expect(i, s).toBeGreaterThan(last);
      last = i;
    }
    expect(REFERENCE_PROMPT.endsWith("eine technisch optimierte, möglichst objektive Referenzaufnahme meines tatsächlichen Gesichts.")).toBe(true);
    expect(REFERENCE_PROMPT).toContain("- Reinweiß (#FFFFFF).");
    expect(REFERENCE_PROMPT).toContain("ABSCHLIESSENDE PRIORITÄTEN:");
    // no UI text inside the prompt
    expect(REFERENCE_PROMPT).not.toContain("So funktioniert");
    expect(REFERENCE_PROMPT).not.toContain("Elite-Prompt kopieren");
  });
});
