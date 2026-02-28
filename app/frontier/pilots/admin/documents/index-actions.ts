"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/profile";
import { getEmbeddings } from "@/lib/ai/embed";
import { extractTextFromBufferWithPages, chunkTextWithPageNumbers } from "@/lib/ai/docs";

// One index run feeds all portal AIs (Pilot, Flight Attendant, etc.)
const PORTALS_TO_INDEX: string[] = ["pilots", "flight-attendants"];

export async function indexDocuments(): Promise<{ error?: string; success?: string }> {
  const admin = await isAdmin();
  if (!admin) {
    return { error: "Admin access required" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "OPENAI_API_KEY not set in .env.local. Add it to enable AI search." };
  }

  try {
    const supabase = await createClient();

    // Clear existing chunks for re-index
    await supabase.from("document_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // List files from documents bucket (recursive scan)

    const allFiles: { name: string; path: string }[] = [];
    const scan = async (prefix: string) => {
      const { data } = await supabase.storage.from("documents").list(prefix, { limit: 500 });
      if (!data) return;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id !== null && item.id !== undefined) {
          allFiles.push({ name: item.name, path });
        } else {
          await scan(path);
        }
      }
    };
    await scan("");

    const { data: settingsRows } = await supabase
      .from("document_ai_settings")
      .select("path, ai_enabled");
    const aiEnabledPaths = new Set(
      (settingsRows ?? []).filter((r) => r.ai_enabled === true).map((r) => r.path)
    );

    const filesToIndex = allFiles.filter((f) => aiEnabledPaths.has(f.path));

    let totalChunks = 0;

    for (const file of filesToIndex) {
      const { data: blob, error: downloadError } = await supabase.storage
        .from("documents")
        .download(file.path);

      if (downloadError || !blob) continue;

      const buffer = Buffer.from(await blob.arrayBuffer());
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mimeTypes: Record<string, string> = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        txt: "text/plain",
        csv: "text/csv",
      };
      const mimeType = mimeTypes[ext];
      if (!mimeType) continue;

      try {
        const { pages } = await extractTextFromBufferWithPages(buffer, mimeType);
        const chunksWithPages = chunkTextWithPageNumbers(pages);
        if (chunksWithPages.length === 0) continue;

        const chunkContents = chunksWithPages.map((c) => c.content);
        const embeddings = await getEmbeddings(chunkContents);
        const category = file.path.split("/")[0];

        for (const portal of PORTALS_TO_INDEX) {
          const rows = chunksWithPages.map((chunk, i) => ({
            content: chunk.content,
            embedding: embeddings[i],
            source_path: file.path,
            source_category: category || "general",
            page_number: chunk.pageNumber,
            metadata: chunk.metadata,
            tenant: "frontier",
            portal,
          }));
          const { error: insertError } = await supabase.from("document_chunks").insert(rows);
          if (insertError) {
            console.error("[Index] Insert error for", file.path, portal, insertError);
            continue;
          }
        }
        totalChunks += chunksWithPages.length;
      } catch (e) {
        console.error("[Index] Error processing", file.path, e);
      }
    }

    return {
      success: "Documents processed. AI can now answer contract questions.",
    };
  } catch (err) {
    console.error("[Index] Error:", err);
    return {
      error: err instanceof Error ? err.message : "Indexing failed",
    };
  }
}
