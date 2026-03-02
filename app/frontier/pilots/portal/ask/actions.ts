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
  /** Retrieved sources (context chunks sent to model, incl. pinned) */
  retrievedSources?: string;
  /** Cited sources (chunks the model cited) */
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

    // Embed the question (expand with regulatory keywords to improve retrieval of CBA/FAR sections)
    const expanded = `${q} FAR 117 flight duty rest period reserve base change Section 12 Section 25`;
    const queryEmbedding = await getEmbedding(expanded);

    // Search for similar chunks (cosine similarity, scoped to tenant/portal)
    const { data: chunks, error: searchError } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.4,
      match_count: 10,
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

    type ChunkRow = {
      id?: string;
      content: string;
      source_path?: string;
      source_category?: string;
      page_number?: number | null;
      metadata?: { page?: number; section?: string; heading?: string } | null;
    };
    const part117Pinned: ChunkRow[] = [];
    const cbaPinned: ChunkRow[] = [];
    const seenIds = new Set<string>();

    // Pin FAR Part 117 chunks for rest/reserve questions so §117.25(e) is always in context
    const needsPart117 = /(\b117\b|far|part\s*117|rest|reserve|fdp|duty|fatigue)/i.test(q);
    if (needsPart117) {
      for (const keyword of ["117.25", "117.21"]) {
        const { data: rows } = await supabase
          .from("document_chunks")
          .select("id, content, source_path, source_category, page_number, metadata")
          .eq("tenant", tenant)
          .eq("portal", portal)
          .ilike("content", `%${keyword}%`)
          .limit(1);
        const chunk = rows?.[0] as ChunkRow | undefined;
        if (chunk && chunk.id && !seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          part117Pinned.push(chunk);
        }
      }
    }

    // Pin CBA Section 12 and 25 for base-change/reserve questions (limited to CBA docs)
    const needsCbaBaseReserve = /(base\s*change|base\s*transfer|transfer|reserve|rsc|rsv)/i.test(q);
    if (needsCbaBaseReserve) {
      const section12Keywords = ["Section 12", "Base Transfers"];
      const section25Keywords = ["Section 25", "Reserve"];
      for (const keyword of section12Keywords) {
        const { data: rows } = await supabase
          .from("document_chunks")
          .select("id, content, source_path, source_category, page_number, metadata")
          .eq("tenant", tenant)
          .eq("portal", portal)
          .ilike("source_path", "%cba%")
          .ilike("content", `%${keyword}%`)
          .limit(1);
        const chunk = rows?.[0] as ChunkRow | undefined;
        if (chunk && chunk.id && !seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          cbaPinned.push(chunk);
          break;
        }
      }
      for (const keyword of section25Keywords) {
        const { data: rows } = await supabase
          .from("document_chunks")
          .select("id, content, source_path, source_category, page_number, metadata")
          .eq("tenant", tenant)
          .eq("portal", portal)
          .ilike("source_path", "%cba%")
          .ilike("content", `%${keyword}%`)
          .limit(1);
        const chunk = rows?.[0] as ChunkRow | undefined;
        if (chunk && chunk.id && !seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          cbaPinned.push(chunk);
          break;
        }
      }
    }

    const pinnedIds = new Set([...part117Pinned, ...cbaPinned].map((c) => c.id).filter(Boolean));
    const existingWithId = contextChunks as (typeof contextChunks[0] & { id?: string })[];
    const rest = existingWithId.filter((c) => !c.id || !pinnedIds.has(c.id));
    // Order: FAR pinned [1][2], CBA pinned [3][4], then vector chunks. Model sees pinned first.
    contextChunks = [...part117Pinned, ...cbaPinned, ...rest].slice(0, 14);

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

CRITICAL ACCURACY RULES:
- Do NOT invent definitions (e.g., "red-eye") unless the excerpts explicitly define them.
- If a term is not defined in the excerpts, say "The excerpts do not define this term" and continue using the rules that ARE present.
- Use the times provided by the pilot to do basic rest/duty calculations when possible.
- If the question provides enough timing to determine compliance with a rule (example: 10-hour rest), you MUST give a conclusion.
- Only say "cannot determine" when a required input is truly missing (example: release time, report time, whether reserve is short-call vs long-call) and explain exactly what is missing.
- Citations like [1], [2] must refer only to retrieved excerpts. Never cite a number for text you made up.

RULE PRIORITY (Part 117):
- For questions about whether a pilot can start reserve/FDP after a flight, first apply §117.25(e) (10 consecutive hours rest immediately before beginning reserve/FDP).
- Only discuss the 30-in-168 rule (§117.25(b)) if the excerpts you received actually include that paragraph AND the question is about 30 hours free from duty in 168 hours.
- Do not treat "red-eye" as a defined legal category unless the excerpts explicitly define "red-eye". If not defined, do not classify the flight as red-eye; just use the provided report/release times and apply the rest rules.

CITATION INTEGRITY:
- If you write "defined as…", the definition must be quoted or directly supported by an excerpt you cite.
- Never cite [5] or any bracket number unless it maps to a provided excerpt.

PART 117 REST LOGIC (MUST FOLLOW):
1) If the question asks whether a pilot can START reserve/FDP after a prior duty/flight, you MUST first apply §117.25(e): at least 10 consecutive hours rest immediately before beginning the reserve/FDP.
2) Use the times given in the question to compute elapsed time between "released/last flight ends" and "reserve/FDP report time".
3) If elapsed time >= 10 hours and there is no other duty mentioned, state that the §117.25(e) requirement is satisfied.
4) Only analyze §117.25(b) (30 hours free from duty in 168 hours) if the question explicitly asks about weekly/168-hour compliance OR the excerpts provided include §117.25(b) and you can clearly explain why it applies.
5) Do NOT claim "30 consecutive hours is required before beginning any reserve" as a general rule. That is only one specific requirement within §117.25 and depends on the 168-hour lookback.

MATH CHECK:
Before concluding, restate the two timestamps you used and the computed rest duration in hours.

TWO-TRACK ANSWERS (for legality questions):
If the user asks whether something is "legal" or asks about "reserve/rest/FAR/Part 117", answer in TWO sections:
A) FAR Part 117 (Legality)
- Apply the Part 117 rest/duty rules to the times provided.
- Give a clear yes/no conclusion under FAR Part 117.
- Include at least one citation to the FAR excerpt used.
- When citing FAR Part 117, include the specific subsection (e.g., §117.25(e)) if it is present in the excerpt.
B) Frontier CBA / Company Rules (Contractual)
- If base change/transfer or reserve is mentioned, address CBA Section 12 and Section 25 if present in the excerpts.
- If NAVBLUE "red-eye" is present in the excerpts, treat it as a bidding/definition rule (not FAR legality) and label it "NAVBLUE definition".
- Include at least one citation to the CBA/NAVBLUE excerpt used.
Do NOT treat "red-eye" as a legal category under FAR unless the FAR excerpt explicitly defines it.

CBA CITATION REQUIREMENT (HARD RULE):
When you write section B (Frontier CBA / Company Rules), you MUST include at least one citation to a CBA excerpt like [#].
If you cannot cite a CBA excerpt because none were provided, you MUST say:
"CBA sections were not present in the provided excerpts, so I cannot make a contractual determination."
Do not make CBA claims without a CBA citation.

CONTEXT AWARENESS:
The prompt includes "Document excerpts" labeled [1], [2], [3]... If CBA excerpts are present there, you MUST use them for section B and cite them.
Do NOT say "CBA sections were not present" if any excerpt labeled as CBA is included.
If the CBA excerpts do not directly answer the question, say:
"The CBA excerpts provided do not address this scenario directly," and then explain what they DO say.

SECTION B MINIMUM OUTPUT:
In section B, always do BOTH:
1) Quote or paraphrase one relevant sentence from Section 12 or Section 25 that was provided.
2) Add a citation to that excerpt [#].
Then state whether that text clearly resolves the base-change/reserve legality; if not, list the missing detail needed (e.g., exact CBA language about post-base-change reserve assignments).

HARD REQUIREMENT FOR SECTION B (CBA):
If any CBA excerpt is present in the provided excerpts, Section B MUST include at least one bracket citation that points to it (e.g., [3] or [4]).
If you discuss Section 12 or Section 25, you must attach the correct citation at the end of the sentence.
Do NOT write a Section B conclusion without at least one CBA citation when CBA excerpts are present.

SECTION B MUST QUOTE:
Include one short quote (<=20 words) from the relevant CBA excerpt and cite it.

If the CBA excerpts do not clearly answer the question, say "The provided CBA excerpts do not clearly resolve this scenario" and explain what additional CBA language/detail is needed.

When stating that a section does not address a scenario, qualify it as:
"The provided excerpts do not explicitly address…"
Do not make global claims about the entire CBA unless explicitly supported.

CRITICAL: When the excerpts contain a section number (e.g. "Section 12.3", "Article 15") or page number near the cited text, you MUST include them. At the end of your answer, add exactly one line in this format:
REF: Section [number from excerpts or —], Page [number from excerpts or —]

Example: REF: Section 12.3, Page 45
Example when not found: REF: Section —, Page —

If the excerpts contain relevant rules/definitions that govern the question, APPLY them to the scenario and answer (even if the scenario is not described word-for-word). Only say "Not found in the provided documents." if the excerpts contain no relevant rule/definition to use.`,
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

    /** Build formatted blocks from chunks, deduped by path+section+page. */
    const buildSourceBlocks = (indices: number[]) => {
      const blocks: string[] = [];
      const seen = new Set<string>();
      for (const idx of indices) {
        const chunk = contextChunks[idx];
        if (!chunk) continue;
        const key = `${chunk.source_path ?? ""}-${chunk.metadata?.section ?? ""}-${chunk.page_number ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const metadata = chunk.metadata ?? null;
        const content = chunk.content ?? "";
        const section = metadata?.section ?? extractSectionFromText(content) ?? null;
        const page = chunk.page_number ?? metadata?.page ?? null;
        const displayName = chunk.source_path ? displayNameByPath[chunk.source_path] : undefined;
        blocks.push(
          formatCitationDisplay(chunk.source_path, chunk.source_category, metadata, section, page, displayName)
        );
      }
      return blocks;
    };

    // Retrieved sources: all context chunks sent to model (pinned first, ensures CBA/FAR always shown)
    const retrievedIndices = contextChunks.map((_, i) => i);
    const retrievedBlocks = buildSourceBlocks(retrievedIndices);
    const retrievedSources = retrievedBlocks.length > 0 ? retrievedBlocks.join("\n\n") : null;

    // Cited sources: chunks the model actually cited
    const citationBlocks = buildSourceBlocks(citedIndices);
    const citation =
      citationBlocks.length > 0
        ? citationBlocks.join("\n\n")
        : formatCitationDisplay(
            contextChunks[0]?.source_path,
            contextChunks[0]?.source_category,
            contextChunks[0]?.metadata,
            null,
            contextChunks[0]?.page_number ?? null,
            contextChunks[0]?.source_path ? displayNameByPath[contextChunks[0].source_path] : undefined
          );
    const citationPath = contextChunks[citedIndices[0]]?.source_path ?? contextChunks[0]?.source_path ?? undefined;

    return { answer: cleanAnswer, retrievedSources: retrievedSources ?? undefined, citation, citationPath };
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
