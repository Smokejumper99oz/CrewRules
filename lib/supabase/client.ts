import { createBrowserClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";

const CREWRULES_REMEMBER = "crewrules-remember";

function getDocumentCookies(keyHints?: string[]): Array<{ name: string; value: string }> {
  const parsed = parse(document.cookie);
  return Object.keys(parsed).map((name) => ({
    name,
    value: parsed[name] ?? "",
  }));
}

function isSessionOnlyRequested(): boolean {
  return parse(document.cookie)[CREWRULES_REMEMBER] === "0";
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: (keyHints?: string[]) => getDocumentCookies(keyHints),
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
          const sessionOnly = isSessionOnlyRequested();
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts: Record<string, unknown> = {
              ...(options ?? {}),
              path: (options?.path as string) ?? "/",
            };
            if (
              sessionOnly &&
              name !== CREWRULES_REMEMBER &&
              opts.maxAge !== 0
            ) {
              delete opts.maxAge;
              delete opts.expires;
            }
            document.cookie = serialize(name, value, opts as Parameters<typeof serialize>[2]);
          });
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}
