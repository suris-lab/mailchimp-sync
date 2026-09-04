import { NextRequest, NextResponse } from "next/server";

const CRON_PATHS = new Set(["/api/backup"]);

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function isAuthorized(request: NextRequest, username: string, password: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return (
      constantTimeEqual(decoded.slice(0, separator), username) &&
      constantTimeEqual(decoded.slice(separator + 1), password)
    );
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // These machine-to-machine routes authenticate themselves in their handlers.
  // The sync POST remains protected so arbitrary callers cannot force a sync.
  if (
    pathname === "/api/webhook" ||
    CRON_PATHS.has(pathname) ||
    (pathname === "/api/sync" && request.method === "GET")
  ) {
    return NextResponse.next();
  }

  const username = process.env.CRM_BASIC_AUTH_USER;
  const password = process.env.CRM_BASIC_AUTH_PASSWORD;

  // Local development remains usable before the optional local credentials are set.
  // Production fails closed if the deployment is misconfigured.
  if (!username || !password) {
    if (process.env.VERCEL_ENV === "production") {
      return new NextResponse("CRM access control is not configured.", { status: 503 });
    }
    return NextResponse.next();
  }

  if (isAuthorized(request, username, password)) return NextResponse.next();

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="HHYC CRM", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
