import { createBrowserClient } from "@supabase/ssr";
import { isIOS } from "@/lib/device";

export function createClient() {
  const storage = isIOS() ? window.localStorage : window.sessionStorage;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}
