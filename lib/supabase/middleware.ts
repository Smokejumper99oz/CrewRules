import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CREWRULES_PATHNAME_HEADER } from "@/lib/crewrules-pathname-header";
import { isSuperAdminAllowlistedEmail } from "@/lib/super-admin/allowlist";

/** Same escape hatch as `gateUserForPortal` (restore / Danger Zone). */
const FRONTIER_PILOTS_PORTAL_ACCOUNT_SETTINGS_PATH = "/frontier/pilots/portal/settings/account";

const DEMO135_OPS_LOGIN_PATH = "/demo135/ops/login";

function normalizeMiddlewarePathname(pathname: string): string {
  const pathOnly = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  return pathOnly.replace(/\/+$/, "") || "/";
}

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CREWRULES_PATHNAME_HEADER, request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const pathname = request.nextUrl.pathname;
  /** Strict pilots portal prefix (avoids matching accidental `/frontier/pilots/portalfoo`). */
  const isFrontierPilotsPortalPath =
    pathname === "/frontier/pilots/portal" || pathname.startsWith("/frontier/pilots/portal/");
  const isPortalRoute = pathname.startsWith("/frontier/pilots/portal");
  const isPortalRoot = pathname === "/frontier/pilots/portal";
  const isAdminRoute = request.nextUrl.pathname.startsWith("/frontier/pilots/admin");
  const isDemo135OpsAdminRoute =
    pathname === "/demo135/ops/admin" || pathname.startsWith("/demo135/ops/admin/");
  const isSuperAdminRoute = request.nextUrl.pathname.startsWith("/super-admin");
  const isAuthRoute =
    request.nextUrl.pathname === "/frontier/pilots/login" ||
    request.nextUrl.pathname === "/frontier/pilots/complete-profile" ||
    request.nextUrl.pathname === "/frontier/pilots/connect-flica" ||
    request.nextUrl.pathname === "/frontier/pilots/sign-up" ||
    request.nextUrl.pathname === "/frontier/pilots/forgot-password" ||
    request.nextUrl.pathname === "/frontier/pilots/reset-password" ||
    request.nextUrl.pathname === "/frontier/pilots/accept-invite" ||
    request.nextUrl.pathname.startsWith("/auth/");

  // Redirect logged-in users away from login/sign-up (but not reset-password - they need to set new password)
  const redirectLoggedInToPortal =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/frontier/pilots/login" ||
    request.nextUrl.pathname === "/cr135/login" ||
    request.nextUrl.pathname === "/frontier/pilots/sign-up" ||
    request.nextUrl.pathname === DEMO135_OPS_LOGIN_PATH;

  let user: { id: string } | null = null;
  let isAdmin = false;
  let isSuperAdmin = false;
  /** Profile row for login/sign-up redirect (aligned with app/api/auth/login/route.ts). */
  let loginGateProfile: {
    role: string | null;
    tenant: string | null;
    portal: string | null;
  } | null = null;
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

    const { data, error: getUserError } = await supabase.auth.getUser();
    user = data?.user ?? null;
    // Stale or revoked refresh token leaves broken cookies; clear session so user is not half-authenticated.
    if (
      getUserError &&
      "code" in getUserError &&
      getUserError.code === "refresh_token_not_found"
    ) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore signOut errors */
      }
      user = null;
    }

    if (
      user &&
      (isAdminRoute ||
        isSuperAdminRoute ||
        redirectLoggedInToPortal ||
        isFrontierPilotsPortalPath ||
        isDemo135OpsAdminRoute)
    ) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, tenant, portal, is_admin")
        .eq("id", user.id)
        .single();
      if (profile) {
        loginGateProfile = {
          role: profile.role ?? null,
          tenant: profile.tenant ?? null,
          portal: profile.portal ?? null,
        };
      }
      const email = (user as { email?: string }).email ?? "";
      const isAllowlisted = isSuperAdminAllowlistedEmail(email);
      isSuperAdmin = profile?.role === "super_admin" || isAllowlisted;
      isAdmin =
        isSuperAdmin ||
        (profile?.role === "tenant_admin" && profile?.tenant === "frontier" && profile?.portal === "pilots") ||
        (profile?.is_admin === true && profile?.tenant === "frontier" && profile?.portal === "pilots");
    }
  } catch {
    // Supabase unreachable (fetch failed, paused project, etc.)
    // Treat as no user so login/sign-up pages still load
  }

  if (isDemo135OpsAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = DEMO135_OPS_LOGIN_PATH;
    url.searchParams.set("error", "not_signed_in");
    return NextResponse.redirect(url);
  }

  if ((isPortalRoute || isAdminRoute || isSuperAdminRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/frontier/pilots/login";
    url.searchParams.set("error", "not_signed_in");
    return NextResponse.redirect(url);
  }

  if (user && isFrontierPilotsPortalPath && loginGateProfile?.role === "tenant_admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/frontier/pilots/admin";
    url.search = "";
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

  if (user && isDemo135OpsAdminRoute) {
    if (!isSuperAdmin) {
      if (!loginGateProfile) {
        const url = request.nextUrl.clone();
        url.pathname = DEMO135_OPS_LOGIN_PATH;
        url.searchParams.set("error", "profile_missing");
        return NextResponse.redirect(url);
      }
      const ok =
        loginGateProfile.role === "tenant_admin" &&
        loginGateProfile.tenant === "demo135" &&
        loginGateProfile.portal === "ops";
      if (!ok) {
        const url = request.nextUrl.clone();
        url.pathname = DEMO135_OPS_LOGIN_PATH;
        url.searchParams.set("error", "role_not_allowed");
        return NextResponse.redirect(url);
      }
    }
  }

  if (isPortalRoot && user && isSuperAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/super-admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (redirectLoggedInToPortal && user) {
    const url = request.nextUrl.clone();
    if (isSuperAdmin) {
      url.pathname = "/super-admin";
      url.search = "";
    } else if (
      loginGateProfile?.role === "tenant_admin" &&
      loginGateProfile.tenant &&
      loginGateProfile.portal
    ) {
      url.pathname = `/${loginGateProfile.tenant}/${loginGateProfile.portal}/admin`;
      url.search = "";
    } else {
      url.pathname = "/frontier/pilots/portal";
    }
    return NextResponse.redirect(url);
  }

  // Pending account deletion: must run on every request (not only when portal layout RSC refetches).
  if (isPortalRoute && user && supabase) {
    const path = normalizeMiddlewarePathname(request.nextUrl.pathname);
    if (path !== FRONTIER_PILOTS_PORTAL_ACCOUNT_SETTINGS_PATH) {
      const email = (user as { email?: string }).email ?? "";
      if (!isSuperAdminAllowlistedEmail(email)) {
        const { data: fpProfile } = await supabase
          .from("profiles")
          .select("role, deleted_at, deletion_scheduled_for")
          .eq("id", user.id)
          .eq("tenant", "frontier")
          .eq("portal", "pilots")
          .maybeSingle();
        if (
          fpProfile &&
          fpProfile.role !== "super_admin" &&
          (fpProfile.deleted_at != null || fpProfile.deletion_scheduled_for != null)
        ) {
          const url = request.nextUrl.clone();
          url.pathname = FRONTIER_PILOTS_PORTAL_ACCOUNT_SETTINGS_PATH;
          url.search = "";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
