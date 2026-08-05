"use client";

import { useState } from "react";
import { FileDown, Share2 } from "lucide-react";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Renders the DOM node with id `targetId` to a paginated A4 PDF blob, client-side. */
async function renderToPdfBlob(targetId: string): Promise<Blob> {
  const el = document.getElementById(targetId);
  if (!el) throw new Error("Nothing to export");

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf.output("blob");
}

type NavigatorShare = Navigator & {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

/** "Download PDF" + "Share" buttons for any printable DOM section (invoices, runs, reports).
 * Share hands the PDF to the device's native share sheet (WhatsApp, email, WeChat, etc.) via
 * the Web Share API, falling back to a plain download where file-sharing isn't supported
 * (most desktop browsers). */
export function PdfShareActions({ targetId, filename, title }: { targetId: string; filename: string; title?: string }) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setError(null);
    setBusy("download");
    try {
      const blob = await renderToPdfBlob(targetId);
      downloadBlob(blob, filename);
    } catch (err) {
      console.error("PDF download failed:", err);
      setError("Could not generate the PDF. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setError(null);
    setBusy("share");
    try {
      const blob = await renderToPdfBlob(targetId);
      const file = new File([blob], filename, { type: "application/pdf" });
      const nav = navigator as NavigatorShare;
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: title ?? filename });
      } else {
        downloadBlob(blob, filename);
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.error("PDF share failed:", err);
        setError("Could not share the PDF. Try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy !== null}
        className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <FileDown size={16} /> {busy === "download" ? "Generating..." : "Download PDF"}
      </button>
      <button
        type="button"
        onClick={handleShare}
        disabled={busy !== null}
        className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Share2 size={16} /> {busy === "share" ? "Preparing..." : "Share"}
      </button>
      {error ? <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
