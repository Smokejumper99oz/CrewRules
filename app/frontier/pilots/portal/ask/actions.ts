"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getEmbedding } from "@/lib/ai/embed";
import OpenAI from "openai";

/** Parse all chunk refs the model cited (e.g. [1], [2], [4]) and return unique 0-based indices. */
function getCitedChunkIndices(answer: string | undefined, chunkCount: number): number[] {
  if (!answer || chunkCount === 0) return [0];
  const matches = [...answer.matchAll(/\[(\d+)\]/g)];
  const indices = new Set<number>();
  for (const m of matches) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= chunkCount) indices.add(n - 1);
  }
  return indices.size > 0 ? [...indices] : [0];
}

/** Derive a display name from storage path when document_display_names has none. */
function displayNameFromPath(path: string): string {
  const filename = path.split("/").pop() ?? "";
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const parts = withoutExt.split("_");
  // Path format: timestamp_category_Display_Name e.g. 1734567890_cba_Frontier_Airlines_CBA_2019
  if (parts.length >= 3) return parts.slice(2).join(" ");
  return withoutExt.replace(/_/g, " ") || path.split("/")[0] || "Document";
}

/** Extract section and page from text (answer, chunk content, or explicit REF line). */
function extractSectionAndPage(
  answer: string | undefined,
  chunkContents: string[]
): { section: string | null; page: string | null; cleanAnswer: string } {
  let section: string | null = null;
  let page: string | null = null;
  let cleanAnswer = answer ?? "";

  // 1. Parse explicit REF line from model: "REF: Section 12.3, Page 45" or "REF: Section —, Page —"
  const refMatch = answer?.match(/\bREF:\s*Section\s+([0-9.A-Za-z]+|[—\-])\s*,\s*Page\s+(\d+|[—\-])/i);
  if (refMatch && answer) {
    cleanAnswer = answer.replace(/\n?\s*REF:[\s\S]*$/, "").trim();
    const s = refMatch[1].trim();
    const p = refMatch[2].trim();
    if (s && s !== "—" && s !== "-") section = s;
    if (p && p !== "—" && p !== "-") page = p;
    return { section, page, cleanAnswer };
  }

  // 2. Search in answer and all chunk contents for section/page patterns (supports 25.A.3.b.ii)
  const searchText = [answer, ...chunkContents].filter(Boolean).join(" ");
  const sectionMatch =
    searchText.match(/\b[Ss]ection\s+([0-9]+(?:\.[A-Za-z0-9]+)*)/i) ??
    searchText.match(/\b[Aa]rticle\s+([0-9]+(?:\.[A-Za-z0-9]+)*)/i) ??
    searchText.match(/§\s*([0-9]+(?:\.[A-Za-z0-9]+)*)/);
  const pageMatch =
    searchText.match(/\b[Pp](?:age|\.|g\.?)\s*[:=]?\s*(\d+)/i) ??
    searchText.match(/\b[Pp]age\s+(\d+)/i);
  section = sectionMatch?.[1] ?? null;
  page = pageMatch?.[1] ?? null;

  return { section, page, cleanAnswer };
}

type ChunkMetadata = { page?: number; section?: string; heading?: string } | null;

/** Extract section from text (Section X, Article X, §X). */
function extractSectionFromText(text: string): string | null {
  const match =
    text.match(/\b(?:Section|Sec\.?)\s+([0-9]+(?:\.[A-Za-z0-9]+)*)/i) ??
    text.match(/\bArticle\s+([0-9]+(?:\.[A-Za-z0-9]+)*)/i) ??
    text.match(/§\s*([0-9]+(?:\.[A-Za-z0-9]+)*)/);
  return match?.[1] ?? null;
}

/** Converts storage path, display name, and metadata into a plain-English citation. */
function formatCitationDisplay(
  sourcePath?: string,
  sourceCategory?: string,
  metadata?: ChunkMetadata | null,
  fallbackSection?: string | null,
  fallbackPage?: string | number | null,
  sourceDisplayName?: string | null
): string {
  if (!sourcePath && !sourceCategory && !sourceDisplayName) {
    return "Source document";
  }

  // Prefer display name (e.g. "Frontier Airlines CBA 2019") over category (e.g. "CBA")
  const sourceLabel = sourceDisplayName?.trim()
    ? `Source: ${sourceDisplayName.trim()}`
    : (() => {
        const cat = (sourceCategory || sourcePath?.split("/")[0] || "").toLowerCase();
        if (cat.includes("cba") && cat.includes("loa")) {
          const loaMatch = cat.match(/loa[-_]?(\d+)/i);
          const loaNum = loaMatch?.[1] ?? "";
          return `Source: Frontier Airlines CBA – LOA ${loaNum || "—"}`;
        }
        if (cat) {
          return `Source: ${cat.split(/[-_]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")}`;
        }
        return "Source: Document";
      })();

  const page = metadata?.page ?? fallbackPage;
  const section = metadata?.section ?? fallbackSection;
  const heading = metadata?.heading;

  const lines: string[] = [sourceLabel];
  if (section) {
    lines.push(`Section ${section}`);
  } else if (heading) {
    lines.push(`Heading: ${heading.length > 60 ? heading.slice(0, 60) + "…" : heading}`);
  }
  lines.push(page != null && page !== "" ? `Page ${page}` : "Page —");
  return lines.join("\n");
}

export type AskResult = {
  error?: string;
  answer?: string;
  citation?: string;
  citationPath?: string;
};

export async function askQuestion(question: string): Promise<AskResult> {
  const q = question?.trim();
  if (!q) {
    return { error: "Please enter a question" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "AI search is not configured. Add OPENAI_API_KEY to .env.local." };
  }

  try {
    const supabase = await createClient();
    const profile = await getProfile();
    const tenant = profile?.tenant ?? "frontier";
    const portal = profile?.portal ?? "pilots";

    // Embed the question
    const queryEmbedding = await getEmbedding(q);

    // Search for similar chunks (cosine similarity, scoped to tenant/portal)
    const { data: chunks, error: searchError } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      p_tenant: tenant,
      p_portal: portal,
    });

    let contextChunks: {
      content: string;
      source_path?: string;
      source_category?: string;
      page_number?: number | null;
      metadata?: { page?: number; section?: string; heading?: string } | null;
    }[] = chunks ?? [];

    if (searchError) {
      const hint =
        searchError.message?.includes("function") || searchError.message?.includes("does not exist") || searchError.message?.includes("operator")
          ? " Run migrations 005, 006, and 010 in Supabase SQL Editor."
          : "";
      return {
        error: `Vector search not ready: ${searchError.message ?? "Unknown error"}${hint}`,
      };
    }

    if (contextChunks.length === 0) {
      return {
        answer: "No relevant documents found. Upload and index CBA and other documents in the Admin portal, then try again.",
        citation: "No citations available",
      };
    }

    const context = contextChunks
      .map((c, i) => `[${i + 1}] (${c.source_category || "doc"}${c.source_path ? ` - ${c.source_path}` : ""})\n${c.content}`)
      .join("\n\n---\n\n");

    const openai = new OpenAI({ apiKey: apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You answer contract and policy questions for airline pilots based ONLY on the provided document excerpts. Be concise. If the answer is in the excerpts, cite the source in brackets e.g. [1] or [2].

CRITICAL: When the excerpts contain a section number (e.g. "Section 12.3", "Article 15") or page number near the cited text, you MUST include them. At the end of your answer, add exactly one line in this format:
REF: Section [number from excerpts or —], Page [number from excerpts or —]

Example: REF: Section 12.3, Page 45
Example when not found: REF: Section —, Page —

If not in the excerpts, say "Not found in the provided documents."`,
        },
        {
          role: "user",
          content: `Document excerpts:\n\n${context}\n\n---\n\nQuestion: ${q}\n\nAnswer (with citation references [1], [2], etc.). End with REF: Section X, Page Y (or — if not in excerpts):`,
        },
      ],
      max_tokens: 550,
    });

    const rawAnswer = completion.choices[0]?.message?.content?.trim() ?? "Could not generate answer.";
    const citedIndices = getCitedChunkIndices(rawAnswer, contextChunks.length);
    const chunkContents = contextChunks.map((c) => c.content).filter(Boolean);
    const { cleanAnswer } = extractSectionAndPage(rawAnswer, chunkContents);

    // Fetch display names (DB first, then derive from path)
    const sourcePaths = [...new Set(contextChunks.map((c) => c.source_path).filter(Boolean))] as string[];
    const displayNameByPath: Record<string, string> = {};
    if (sourcePaths.length > 0) {
      try {
        const { data: displayRows } = await supabase
          .from("document_display_names")
          .select("path, display_name")
          .in("path", sourcePaths);
        for (const r of displayRows ?? []) {
          if (r.path && r.display_name) displayNameByPath[r.path] = r.display_name;
        }
      } catch {
        /* document_display_names may not exist */
      }
    }
    for (const p of sourcePaths) {
      if (!displayNameByPath[p]) displayNameByPath[p] = displayNameFromPath(p);
    }

    // Build a citation block for each cited chunk (section/page from that chunk only)
    const citationBlocks: string[] = [];
    const seenKeys = new Set<string>();
    for (const idx of citedIndices) {
      const chunk = contextChunks[idx];
      if (!chunk) continue;
      const key = `${chunk.source_path ?? ""}-${chunk.metadata?.section ?? ""}-${chunk.page_number ?? ""}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const metadata = chunk.metadata ?? null;
      const content = chunk.content ?? "";
      const section = metadata?.section ?? extractSectionFromText(content) ?? null;
      const page = chunk.page_number ?? metadata?.page ?? null;
      const displayName = chunk.source_path ? displayNameByPath[chunk.source_path] : undefined;
      citationBlocks.push(
        formatCitationDisplay(chunk.source_path, chunk.source_category, metadata, section, page, displayName)
      );
    }

    const citation = citationBlocks.length > 0 ? citationBlocks.join("\n\n") : formatCitationDisplay(
      contextChunks[0]?.source_path,
      contextChunks[0]?.source_category,
      contextChunks[0]?.metadata,
      null,
      contextChunks[0]?.page_number ?? null,
      contextChunks[0]?.source_path ? displayNameByPath[contextChunks[0].source_path] : undefined
    );
    const citationPath = contextChunks[citedIndices[0]]?.source_path ?? contextChunks[0]?.source_path ?? undefined;

    return { answer: cleanAnswer, citation, citationPath };
  } catch (err) {
    console.error("[Ask] Error:", err);
    return {
      error: err instanceof Error ? err.message : "Search failed",
    };
  }
}

export async function getCitationDownloadUrl(path: string): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error) return { error: error.message };
    return { url: data.signedUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Download failed" };
  }
}
