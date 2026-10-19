"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import type { ScanExtraction, ScanKind } from "@/lib/scan/extract";
import { btnSecondary } from "./ui";

type ScanApiResult = { error: string | null; data?: ScanExtraction };

const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024; // the API route rejects over 4MB
const MAX_EDGE = 2000; // plenty to read receipt print; keeps uploads small and fast

/** Phone photos are often 5–12MB. Shrinks images to a readable size and re-encodes as JPEG
 * (which also converts HEIC where the browser can decode it). PDFs and anything the browser
 * can't decode are sent as-is. */
export async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const alreadySmall = scale === 1 && file.size <= MAX_UPLOAD_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type);
    if (alreadySmall) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
    return file;
  } catch {
    return file;
  }
}

/** A "scan a photo" button used on Expenses, Purchases, Cash-up, Stock counts and Checklists.
 * Uploads the photo (or PDF) to `/api/scan` and hands the extracted fields to the caller to
 * pre-fill its form. It never saves anything itself — whether a scan is saved automatically is
 * the caller's decision (an org setting). */
export function ScanButton({ kind, label = "Scan a photo", onExtracted }: { kind: ScanKind; label?: string; onExtracted: (data: ScanExtraction, file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (original: File) => {
    setBusy(true);
    setError(null);
    try {
      const file = await prepareFile(original);
      const form = new FormData();
      form.set("kind", kind);
      form.set("image", file);
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const result = (await res.json().catch(() => null)) as ScanApiResult | null;
      if (!res.ok || !result || result.error || !result.data) {
        setError(result?.error ?? (res.status === 413 ? "That file is too large — try a smaller one." : "Couldn't read that photo."));
        return;
      }
      onExtracted(result.data, file);
    } catch {
      setError("Couldn't reach the scanner. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full sm:w-auto">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={`flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto ${btnSecondary}`}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
        {busy ? "Reading photo..." : label}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
