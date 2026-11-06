import QRCode from "qrcode";
import { requireUserApi, startTotpEnrollment } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { totpSetupSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts enrollment: returns the otpauth URI, a QR code (SVG data URL) and the manual key. */
export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = totpSetupSchema.parse(await readJson(req));
    const { secretFormatted, uri } = startTotpEnrollment(user.id, body.password, user.email);
    const svg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 220, color: { dark: "#eef0f3", light: "#0c0e12" } });
    const qrDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return ok({ uri, qrDataUrl, secretFormatted }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
