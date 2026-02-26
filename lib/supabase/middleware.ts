import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const isPortalRoute = request.nextUrl.pathname.startsWith("/frontier/pilots/portal");
  const isAdminRoute = request.nextUrl.pathname.startsWith("/frontier/pilots/admin");
  const isAuthRoute =
    request.nextUrl.pathname === "/frontier/pilots/login" ||
    request.nextUrl.pathname === "/frontier/pilots/sign-up";

  let user: { id: string } | null = null;
  let isAdmin = false;
  let supabase: ReturnType<typeof createServerClient> | null = null;

  try {
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;

    if (user && isAdminRoute) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
    }
  } catch {
    // Supabase unreachable (fetch failed, paused project, etc.)
    // Treat as no user so login/sign-up pages still load
  }

  if ((isPortalRoute || isAdminRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/frontier/pilots/login";
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && user && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/frontier/pilots/portal";
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/frontier/pilots/portal";
    return NextResponse.redirect(url);
  }

  // Log out when navigating away from portal/admin to public pages
  // Prevents bookmarking portal and returning without re-login
  if (user && supabase && !isPortalRoute && !isAdminRoute && !isAuthRoute) {
    await supabase.auth.signOut();
  }

  return supabaseResponse;
}
