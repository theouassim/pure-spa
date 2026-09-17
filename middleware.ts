import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Les inscriptions Supabase sont ouvertes : être connecté ne suffit pas,
// il faut une ligne admin_users non révoquée.
async function isAdminMember(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["active", "invited"])
    .maybeSingle();
  return !!data;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/admin");
  const isLogin = pathname === "/admin/login";

  const supabase = createServerClient(
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
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authorized = !!user && (await isAdminMember(user.id));

  if (!authorized) {
    if (isApi) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (isLogin) {
      return response;
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (isLogin) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
