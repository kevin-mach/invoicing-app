/** Client-only: runs OCR on a receipt image in the browser via WASM. Never import from a Server Component. */
export async function recognizeReceiptText(image: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(image);
    return text;
  } finally {
    await worker.terminate();
  }
}
