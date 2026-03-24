import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const isPortalRoute = request.nextUrl.pathname.startsWith("/frontier/pilots/portal");
  const isPortalRoot = request.nextUrl.pathname === "/frontier/pilots/portal";
  const isAdminRoute = request.nextUrl.pathname.startsWith("/frontier/pilots/admin");
  const isSuperAdminRoute = request.nextUrl.pathname.startsWith("/super-admin");
  const isAuthRoute =
    request.nextUrl.pathname === "/frontier/pilots/login" ||
    request.nextUrl.pathname === "/frontier/pilots/complete-profile" ||
    request.nextUrl.pathname === "/frontier/pilots/connect-flica" ||
    request.nextUrl.pathname === "/frontier/pilots/sign-up" ||
    request.nextUrl.pathname === "/frontier/pilots/forgot-password" ||
    request.nextUrl.pathname === "/frontier/pilots/reset-password" ||
    request.nextUrl.pathname.startsWith("/auth/");

  // Redirect logged-in users away from login/sign-up (but not reset-password - they need to set new password)
  const redirectLoggedInToPortal =
    request.nextUrl.pathname === "/frontier/pilots/login" ||
    request.nextUrl.pathname === "/frontier/pilots/sign-up";

  let user: { id: string } | null = null;
  let isAdmin = false;
  let isSuperAdmin = false;
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

    if (user && (isAdminRoute || isSuperAdminRoute || redirectLoggedInToPortal || isPortalRoot)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, tenant, portal")
        .eq("id", user.id)
        .single();
      const email = ((user as { email?: string }).email ?? "").toLowerCase().trim();
      const isAllowlisted = ["svenfolmer92@gmail.com"].some((e) => e.toLowerCase() === email);
      isSuperAdmin = profile?.role === "super_admin" || isAllowlisted;
      isAdmin =
        isSuperAdmin ||
        (profile?.role === "tenant_admin" && profile?.tenant === "frontier" && profile?.portal === "pilots");
    }
  } catch {
    // Supabase unreachable (fetch failed, paused project, etc.)
    // Treat as no user so login/sign-up pages still load
  }

  if ((isPortalRoute || isAdminRoute || isSuperAdminRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/frontier/pilots/login";
    url.searchParams.set("error", "not_signed_in");
    return NextResponse.redirect(url);
  }

  if (isSuperAdminRoute && user && !isSuperAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/frontier/pilots/portal";
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && user && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/frontier/pilots/portal";
    return NextResponse.redirect(url);
  }

  if (isPortalRoot && user && isSuperAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/super-admin";
    return NextResponse.redirect(url);
  }

  if (redirectLoggedInToPortal && user) {
    const url = request.nextUrl.clone();
    url.pathname = isSuperAdmin ? "/super-admin" : "/frontier/pilots/portal";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
