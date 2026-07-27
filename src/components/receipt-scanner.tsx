"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recognizeReceiptText } from "@/lib/ocr/tesseract";
import { parseReceiptLines, type ParsedReceiptLine } from "@/lib/ocr/parse-lines";

export function ReceiptScanner({
  orgId,
  onScanned,
}: {
  orgId: string;
  onScanned: (rows: ParsedReceiptLine[], imageUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "reading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setStatus("uploading");
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${orgId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 60 * 24 * 7);
      const imageUrl = signed?.signedUrl ?? path;

      setStatus("reading");
      const text = await recognizeReceiptText(file);
      const rows = parseReceiptLines(text);

      onScanned(rows, imageUrl);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not scan receipt.");
      setStatus("error");
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={status === "uploading" || status === "reading"}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {status === "uploading" || status === "reading" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Camera size={16} />
        )}
        {status === "uploading" ? "Uploading..." : status === "reading" ? "Reading receipt..." : "Scan receipt"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
