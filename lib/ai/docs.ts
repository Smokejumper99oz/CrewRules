import mammoth from "mammoth";

// pdf-parse v1.1.1 - works with text-based PDFs (avoid unpdf which returned 0 chunks)
// Dynamic require to avoid Webpack "reading 'run'" errors with serverExternalPackages
async function getPdfParse(): Promise<(buffer: Buffer, opts?: object) => Promise<{ numpages: number; numrender: number; info: object; metadata: object; text: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buffer: Buffer, opts?: object) => Promise<{ numpages: number; numrender: number; info: object; metadata: object; text: string }>;
  return pdfParse;
}

export type PageText = { text: string; pageNumber: number };

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string }> {
  const { pages } = await extractTextFromBufferWithPages(buffer, mimeType);
  const text = pages.map((p) => p.text).join("\n\n");
  return { text };
}

/** Extract text with page numbers for PDFs; non-PDF returns a single page. */
export async function extractTextFromBufferWithPages(
  buffer: Buffer,
  mimeType: string
): Promise<{ pages: PageText[] }> {
  if (mimeType === "application/pdf") {
    const pages: PageText[] = [];
    let pageNum = 0;
    const pagerender = (pageData: { getTextContent: (opts: object) => Promise<{ items: { str: string; transform: number[] }[] }> }) => {
      pageNum += 1;
      const renderOpts = { normalizeWhitespace: false, disableCombineTextItems: false };
      return pageData.getTextContent(renderOpts).then((textContent: { items: { str: string; transform: number[] }[] }) => {
        let lastY: number | null = null;
        let text = "";
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || lastY === null) {
            text += item.str;
          } else {
            text += "\n" + item.str;
          }
          lastY = item.transform[5];
        }
        pages.push({ text, pageNumber: pageNum });
        return text;
      });
    };
    const pdfParse = await getPdfParse();
    const data = await pdfParse(buffer, { pagerender });
    return { pages };
  }
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { pages: [{ text: result.value ?? "", pageNumber: 1 }] };
  }
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return { pages: [{ text: buffer.toString("utf-8"), pageNumber: 1 }] };
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

export type ChunkMetadata = { page: number; section?: string; heading?: string };

export type ChunkWithPage = { content: string; pageNumber: number; metadata: ChunkMetadata };

/** Section pattern: 25, 25.1, 25.A.3.b.ii (digits + optional dotted segments with letters/numbers) */
const SECTION_NUM = "[0-9]+(?:\\.[A-Za-z0-9]+)*";

/** Extract section (Section 25.A.3.b.ii, Article 15.2.1, §12) or heading from chunk start. */
function extractSectionOrHeading(content: string): { section?: string; heading?: string } {
  const trimmed = content.trim();
  if (!trimmed) return {};
  const sectionMatch =
    trimmed.match(new RegExp(`^\\s*(?:Section|Sec\\.?)\\s+(${SECTION_NUM})`, "i")) ??
    trimmed.match(new RegExp(`\\b(?:Section|Sec\\.?)\\s+(${SECTION_NUM})`, "i")) ??
    trimmed.match(new RegExp(`^\\s*Article\\s+(${SECTION_NUM})`, "i")) ??
    trimmed.match(new RegExp(`\\bArticle\\s+(${SECTION_NUM})`, "i")) ??
    trimmed.match(new RegExp(`§\\s*(${SECTION_NUM})`));
  if (sectionMatch) return { section: sectionMatch[1] };
  const firstLine = trimmed.split(/\n/)[0]?.trim() ?? "";
  if (firstLine.length > 3 && firstLine.length < 120) return { heading: firstLine };
  return {};
}

/** Chunk each page's text and tag chunks with page + metadata (section/heading). */
export function chunkTextWithPageNumbers(
  pages: PageText[],
  chunkSize = 500,
  overlap = 50
): ChunkWithPage[] {
  const result: ChunkWithPage[] = [];
  for (const { text, pageNumber } of pages) {
    const chunks = chunkText(text, chunkSize, overlap);
    for (const content of chunks) {
      const { section, heading } = extractSectionOrHeading(content);
      const metadata: ChunkMetadata = { page: pageNumber };
      if (section) metadata.section = section;
      if (heading) metadata.heading = heading;
      result.push({ content, pageNumber, metadata });
    }
  }
  return result;
}
