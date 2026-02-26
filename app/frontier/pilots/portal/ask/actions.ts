"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getEmbedding } from "@/lib/ai/embed";
import OpenAI from "openai";

export type AskResult = {
  error?: string;
  answer?: string;
  citation?: string;
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

    let contextChunks: { content: string; source_path?: string; source_category?: string }[] = chunks ?? [];

    if (searchError) {
      const hint =
        searchError.message?.includes("function") || searchError.message?.includes("does not exist")
          ? " Run migrations 005 and 006 in Supabase SQL Editor."
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
          content: `You answer contract and policy questions for airline pilots based ONLY on the provided document excerpts. Be concise. If the answer is in the excerpts, cite the source in brackets e.g. [1] or [2]. If not in the excerpts, say "Not found in the provided documents."`,
        },
        {
          role: "user",
          content: `Document excerpts:\n\n${context}\n\n---\n\nQuestion: ${q}\n\nAnswer (with citation references):`,
        },
      ],
      max_tokens: 500,
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? "Could not generate answer.";
    const topChunk = contextChunks[0];
    const citation = topChunk?.source_path
      ? `${topChunk.source_category || "Document"}: ${topChunk.source_path}`
      : "Source document";

    return { answer, citation };
  } catch (err) {
    console.error("[Ask] Error:", err);
    return {
      error: err instanceof Error ? err.message : "Search failed",
    };
  }
}
