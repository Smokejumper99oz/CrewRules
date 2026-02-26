"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/profile";
import { getEmbeddings } from "@/lib/ai/embed";
import { extractTextFromBuffer, chunkText } from "@/lib/ai/docs";

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

    let totalChunks = 0;

    for (const file of allFiles) {
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
        const { text } = await extractTextFromBuffer(buffer, mimeType);
        if (!text.trim()) continue;

        const chunks = chunkText(text);
        if (chunks.length === 0) continue;

        const embeddings = await getEmbeddings(chunks);
        const category = file.path.split("/")[0];

        for (const portal of PORTALS_TO_INDEX) {
          const rows = chunks.map((content, i) => ({
            content,
            embedding: embeddings[i],
            source_path: file.path,
            source_category: category || "general",
            tenant: "frontier",
            portal,
          }));
          const { error: insertError } = await supabase.from("document_chunks").insert(rows);
          if (insertError) {
            console.error("[Index] Insert error for", file.path, portal, insertError);
            continue;
          }
        }
        totalChunks += chunks.length;
      } catch (e) {
        console.error("[Index] Error processing", file.path, e);
      }
    }

    return {
      success: `Indexed ${totalChunks} chunks for Pilot & Flight Attendant AI from ${allFiles.length} files.`,
    };
  } catch (err) {
    console.error("[Index] Error:", err);
    return {
      error: err instanceof Error ? err.message : "Indexing failed",
    };
  }
}
