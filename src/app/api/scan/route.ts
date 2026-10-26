import { NextResponse, type NextRequest } from "next/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { extractFromImage, scanConfigured, type ScanKind } from "@/lib/scan/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // 4MB raw — keeps the base64 payload comfortably under the API's per-image limit
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const KINDS: ScanKind[] = ["receipt", "bill", "till", "list", "statement", "credit_note", "fuel"];

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  if (!scanConfigured()) {
    return NextResponse.json({ error: "AI photo scanning isn't set up on this server yet — ask the operator to add ANTHROPIC_API_KEY." }, { status: 501 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Couldn't read the upload." }, { status: 400 });
  }

  const kindRaw = form.get("kind");
  const kind = typeof kindRaw === "string" && (KINDS as string[]).includes(kindRaw) ? (kindRaw as ScanKind) : null;
  if (!kind) return NextResponse.json({ error: "Unknown scan type." }, { status: 400 });

  const file = form.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "No image was uploaded." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Use a JPEG, PNG, WEBP or GIF photo, or a PDF." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is too large — try a smaller one (under 4MB)." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await extractFromImage(kind, buffer.toString("base64"), file.type);
    return NextResponse.json({ error: null, data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't read that image." }, { status: 502 });
  }
}
