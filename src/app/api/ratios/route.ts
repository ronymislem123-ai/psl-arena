import { ADDITIONAL_DEFINITIONS, CATEGORY_META, RATIO_DEFINITIONS } from "@/engine/ratios/database";
import { ok } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  return ok({ ratios: RATIO_DEFINITIONS, additional: ADDITIONAL_DEFINITIONS, categories: CATEGORY_META });
}
