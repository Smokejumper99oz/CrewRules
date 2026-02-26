import mammoth from "mammoth";

// pdf-parse v1.1.1 - works with text-based PDFs (avoid unpdf which returned 0 chunks)
const pdfParse = require("pdf-parse");

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string }> {
  if (mimeType === "application/pdf") {
    const data = await pdfParse(buffer);
    return { text: data?.text ?? "" };
  }
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value };
  }
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return { text: buffer.toString("utf-8") };
  }
  throw new Error(`Unsupported type: ${mimeType}`);
}

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  let start = 0;
  while (start < cleaned.length) {
    let end = start + chunkSize;
    if (end < cleaned.length) {
      const lastSpace = cleaned.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }
    chunks.push(cleaned.slice(start, end));
    start = end - overlap;
    if (start >= cleaned.length) break;
  }
  return chunks.filter((c) => c.length > 20);
}
