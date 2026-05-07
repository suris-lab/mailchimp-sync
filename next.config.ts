import type { NextConfig } from "next";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// Patch = total commit count — auto-increments on every push, no manual bump needed.
// Major.minor still come from package.json for intentional milestone bumps.
const commitCount = (() => {
  try {
    return execSync("git rev-list --count HEAD").toString().trim();
  } catch {
    return "0";
  }
})();

const [major, minor] = pkg.version.split(".");
const appVersion = `${major}.${minor}.${commitCount}`;

const securityHeaders = [
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis"],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
