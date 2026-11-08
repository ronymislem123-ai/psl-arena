import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inputFromFixture, loadFixture } from "./helpers";
import { assessWithClaude, splitDataUrl, toAssessmentSet, VisualModelError, VISUAL_MODEL_CRITERIA } from "@/lib/visual-model/claude";

const dir = mkdtempSync(join(tmpdir(), "psl-visual-"));
process.env.PSL_ARENA_DATA_DIR = dir;
const auth = await import("@/server/auth");
const db = await import("@/server/db");
const services = await import("@/server/services");
const sv = await import("@/server/services-psl");
const vp = await import("@/server/vision-provider");
const cfg = await import("@/server/vision-config");

const PNG_1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** A Messages API response whose text block is the structured output. */
function apiResponse(output: unknown, stop = "end_turn") {
  return {
    id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: stop, stop_sequence: null,
    content: stop === "refusal" ? [] : [{ type: "text", text: JSON.stringify(output) }],
    usage: { input_tokens: 1000, output_tokens: 100 },
  };
}
function mockFetch(status: number, body: unknown, seen: { url?: string; body?: Record<string, unknown>; headers?: Headers }[] = []): typeof fetch {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_test" } });
  }) as typeof fetch;
}

const GOOD: Parameters<typeof toAssessmentSet>[0] = {
  assessments: [
    { criterion: "eyeShape", assessable: true, score: 6.5, confidence: 0.7, note: "Almond-shaped fissures." },
    { criterion: "lipShape", assessable: true, score: 12, confidence: 1.4, note: "Defined vermilion." },
    { criterion: "jawlineDefinition", assessable: false, score: 0, confidence: 0.2, note: "Beard covers the border." },
    { criterion: "cheekboneProjection", assessable: true, score: 5, confidence: 0.5, note: "Average malar contour." },
  ],
};

describe("vision model (Claude API) — request and response contract", () => {
  it("asks exactly the four visual criteria, sends the photo as base64 and parses the structured output", async () => {
    const seen: { url?: string; body?: Record<string, unknown>; headers?: Headers }[] = [];
    const set = await assessWithClaude({ base64: "QUJD", mime: "image/jpeg" }, { apiKey: "sk-test", fetch: mockFetch(200, apiResponse(GOOD), seen), lang: "de" });
    expect(VISUAL_MODEL_CRITERIA.map((c) => c.id).sort()).toEqual(["cheekboneProjection", "eyeShape", "jawlineDefinition", "lipShape"]);
    const req = seen[0];
    expect(req.url).toMatch(/\/v1\/messages/);
    expect(req.url).toMatch(/^https:\/\/api\.anthropic\.com\//);
    // the configured key is the only credential (no ANTHROPIC_AUTH_TOKEN from the process environment)
    expect(req.headers!.get("authorization") ?? req.headers!.get("x-api-key")).toMatch(/sk-test/);
    expect(req.body!.model).toBe("claude-opus-5-5");
    expect(req.body!.fallbacks).toBe("default");
    const content = (req.body!.messages as { content: { type: string; source?: { data: string } }[] }[])[0].content;
    expect(content[0].type).toBe("image");
    expect(content[0].source!.data).toBe("QUJD");
    expect(JSON.stringify(req.body!.output_config)).toContain("json_schema");
    expect(String(req.body!.system)).toMatch(/do not identify the person/);
    // validated: clamped to 0–10 / 0–1, not-assessable criteria are omitted
    expect(set.providerId).toBe("claude");
    expect(set.assessments.eyeShape).toEqual({ score: 6.5, confidence: 0.7, note: "Almond-shaped fissures." });
    expect(set.assessments.lipShape!.score).toBe(10);
    expect(set.assessments.lipShape!.confidence).toBe(1);
    expect(set.assessments.jawlineDefinition).toBeUndefined();
  });
  it("maps API failures to typed errors (no simulated fallback)", async () => {
    const err = { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } };
    await expect(assessWithClaude({ base64: "QUJD", mime: "image/jpeg" }, { apiKey: "bad", fetch: mockFetch(401, err) })).rejects.toMatchObject({ code: "auth" });
    await expect(assessWithClaude({ base64: "QUJD", mime: "image/jpeg" }, { apiKey: "k", fetch: mockFetch(200, apiResponse(null, "refusal")) })).rejects.toBeInstanceOf(VisualModelError);
  });
  it("normalises output and splits data URLs", () => {
    const s = toAssessmentSet({ assessments: [{ criterion: "eyeShape", assessable: true, score: -3, confidence: 0.5, note: "x".repeat(600) }] }, "m");
    expect(s.assessments.eyeShape!.score).toBe(0);
    expect(s.assessments.eyeShape!.note).toHaveLength(400);
    expect(splitDataUrl(PNG_1x1)!.mime).toBe("image/png");
    expect(splitDataUrl("data:text/plain;base64,QQ==")).toBeNull();
  });
});

describe("vision model — configuration and consent in the rating service", () => {
  let userId = "";
  beforeAll(() => {
    db.closeDb();
    userId = auth.signup({ email: "visual@example.com", password: "visual strong password", name: "V" }).id;
  });
  afterAll(() => {
    vp.setVisualProviderForTests(undefined);
    delete process.env.PSL_ARENA_VISION_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    db.closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  it("is configured only with provider + key in the environment", () => {
    delete process.env.PSL_ARENA_VISION_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    expect(cfg.visionConfig()).toBeNull();
    expect(vp.providerStatus()).toMatchObject({ configured: false, hint: "notConfigured" });
    process.env.PSL_ARENA_VISION_PROVIDER = "claude";
    expect(vp.providerStatus().hint).toBe("missingKey");
    process.env.ANTHROPIC_API_KEY = "sk-env";
    expect(vp.providerStatus()).toMatchObject({ configured: true, providerId: "claude", model: "claude-opus-5-5" });
  });

  it("without a model: visual criteria not assessable with a clear reason, two eyelid criteria are measured", async () => {
    vp.setVisualProviderForTests(null);
    const a = services.createAnalysis(userId, { profileLabel: "NoModel", storeImage: false, input: inputFromFixture(loadFixture("ai-face")) });
    const r = await sv.createRating(userId, { analysisId: a.id });
    const c = (id: string) => r.result.criteria.find((x) => x.id === id)!;
    expect(c("eyeShape").notAssessableCode).toBe("visualNotConfigured");
    expect(c("scleralShow").assessable).toBe(true);
    expect(c("scleralShow").usedInputs).toEqual(["SSI"]);
    expect(c("upperLidExposure").assessable).toBe(true);
    expect(r.result.inputs.visualStatus).toBe("notConfigured");
  });

  it("with a model: sends the photo only with consent, uses and labels the result", async () => {
    let calls = 0;
    vp.setVisualProviderForTests({
      id: "claude", modelVersion: "test-model",
      assess: async (img) => {
        calls++;
        expect(img.mime).toBe("image/png");
        return toAssessmentSet(GOOD, "test-model");
      },
    });
    const a = services.createAnalysis(userId, { profileLabel: "Model", storeImage: false, input: inputFromFixture(loadFixture("ai-face")) });
    const noConsent = await sv.createRating(userId, { analysisId: a.id, visualImageDataUrl: PNG_1x1 });
    expect(calls).toBe(0);
    expect(noConsent.result.criteria.find((x) => x.id === "eyeShape")!.notAssessableCode).toBe("visualNoConsent");
    const noImage = await sv.createRating(userId, { analysisId: a.id, visualConsent: true });
    expect(calls).toBe(0);
    expect(noImage.result.inputs.visualStatus).toBe("noImage");
    const used = await sv.createRating(userId, { analysisId: a.id, visualConsent: true, visualImageDataUrl: PNG_1x1 });
    expect(calls).toBe(1);
    const eye = used.result.criteria.find((x) => x.id === "eyeShape")!;
    expect(eye.assessable).toBe(true);
    expect(eye.source).toBe("visual-model");
    expect(eye.score).toBeCloseTo(6.5, 6);
    expect(used.result.criteria.find((x) => x.id === "jawlineDefinition")!.notAssessableCode).toBe("visualNotAssessable");
    expect(used.result.inputs).toMatchObject({ visualStatus: "used", visualProvider: "claude", visualModel: "test-model" });
    expect(used.result.visualNotes!.eyeShape).toBe("Almond-shaped fissures.");
  });

  it("a failing model call does not break the rating and is reported", async () => {
    vp.setVisualProviderForTests({ id: "claude", modelVersion: "m", assess: async () => { throw new VisualModelError("rejected", "auth"); } });
    const a = services.createAnalysis(userId, { profileLabel: "Fail", storeImage: false, input: inputFromFixture(loadFixture("ai-face")) });
    const r = await sv.createRating(userId, { analysisId: a.id, visualConsent: true, visualImageDataUrl: PNG_1x1 });
    expect(r.result.inputs.visualStatus).toBe("failed");
    expect(r.result.inputs.visualError).toBe("auth");
    expect(r.result.warningCodes).toContain("visualFailed");
    expect(r.result.score).not.toBeNull();
  });
});
