import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { validateStartupConfig } from "../packages/server/src/config/startup";
import { getClearCookieOptions, getSessionCookieOptions } from "../packages/server/src/auth/jwt";

let passes = 0;
let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passes++;
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== Staging Deployment Readiness Check ===\n");

// 1. Startup Configuration Validation
console.log("Section 1: Startup Config Validation");
const invalidMissingAll = validateStartupConfig({} as any);
check("Rejects missing DATABASE_URL", invalidMissingAll.errors.some((e) => e.includes("DATABASE_URL")));
check("Rejects missing JWT_SECRET", invalidMissingAll.errors.some((e) => e.includes("JWT_SECRET")));
check("Overall validation returns valid=false on missing secrets", invalidMissingAll.valid === false);

const invalidBadUrl = validateStartupConfig({
  DATABASE_URL: "http://invalid-db-url",
  JWT_SECRET: "01234567890123456789012345678901",
});
check("Rejects non-postgres protocol in DATABASE_URL", invalidBadUrl.errors.some((e) => e.includes("protocol")));

const validProdConfig = validateStartupConfig({
  DATABASE_URL: "postgresql://user:pass@host:5432/fugluck_staging?sslmode=require",
  JWT_SECRET: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  PORT: "4000",
  NODE_ENV: "production",
  CLIENT_ORIGIN: "https://staging.fugluck.com",
});
check("Accepts valid staging/production configuration", validProdConfig.valid === true);
check("No errors on valid configuration", validProdConfig.errors.length === 0);

// 2. Cookie Options & Cross-Subdomain Security
console.log("\nSection 2: Cookie Security & Cross-Subdomain Options");
const originalEnv = { ...process.env };
process.env.NODE_ENV = "production";
process.env.COOKIE_DOMAIN = ".fugluck.com";
process.env.COOKIE_SAMESITE = "lax";

const sessionOpts = getSessionCookieOptions();
check("Production session cookie is HttpOnly", sessionOpts.httpOnly === true);
check("Production session cookie is Secure", sessionOpts.secure === true);
check("Production session cookie has Domain=.fugluck.com", sessionOpts.domain === ".fugluck.com");
check("Production session cookie has SameSite=lax", sessionOpts.sameSite === "lax");
check("Production session cookie maxAge is 7 days", sessionOpts.maxAge === 7 * 24 * 60 * 60 * 1000);

const clearOpts = getClearCookieOptions();
check("Clear cookie options preserve Domain", clearOpts.domain === ".fugluck.com");
check("Clear cookie options preserve SameSite", clearOpts.sameSite === "lax");
check("Clear cookie options preserve Secure", clearOpts.secure === true);

// Restore env
process.env = originalEnv;

// 3. Vercel SPA Routing Configuration
console.log("\nSection 3: Vercel SPA Hosting Artifacts");
const vercelJsonPath = path.resolve(process.cwd(), "packages/client/vercel.json");
check("packages/client/vercel.json exists", fs.existsSync(vercelJsonPath));
if (fs.existsSync(vercelJsonPath)) {
  const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
  check("vercel.json contains rewrites array", Array.isArray(vercelJson.rewrites));
  check("vercel.json rewrites /(.*) to /index.html", vercelJson.rewrites?.[0]?.source === "/(.*)" && vercelJson.rewrites?.[0]?.destination === "/index.html");
}

// 4. Render Blueprint Specification
console.log("\nSection 4: Render Deployment Specification");
const renderYamlPath = path.resolve(process.cwd(), "render.yaml");
check("render.yaml exists at repository root", fs.existsSync(renderYamlPath));
if (fs.existsSync(renderYamlPath)) {
  const content = fs.readFileSync(renderYamlPath, "utf-8");
  check("render.yaml configures health check at /health", content.includes("healthCheckPath: /health"));
  check("render.yaml specifies build:server", content.includes("npm run build:server"));
  check("render.yaml specifies start:server", content.includes("npm run start:server"));
}

// 5. Documentation & Environment Templates
console.log("\nSection 5: Documentation & Environment Templates");
const deploymentMdPath = path.resolve(process.cwd(), "DEPLOYMENT.md");
check("DEPLOYMENT.md exists at repository root", fs.existsSync(deploymentMdPath));
check("Root .env.example exists", fs.existsSync(path.resolve(process.cwd(), ".env.example")));
check("Client .env.example exists", fs.existsSync(path.resolve(process.cwd(), "packages/client/.env.example")));
check("Server .env.example exists", fs.existsSync(path.resolve(process.cwd(), "packages/server/.env.example")));

// 6. Monorepo Package Scripts
console.log("\nSection 6: Monorepo Package Scripts");
const rootPkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
const serverPkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "packages/server/package.json"), "utf-8"));

check("Root package.json has build:client", typeof rootPkg.scripts?.["build:client"] === "string");
check("Root package.json has build:server", typeof rootPkg.scripts?.["build:server"] === "string");
check("Root package.json has start:server", typeof rootPkg.scripts?.["start:server"] === "string");
check("Root package.json has db:migrate", typeof rootPkg.scripts?.["db:migrate"] === "string");
check("Root package.json has typecheck", typeof rootPkg.scripts?.["typecheck"] === "string");
check("Server package.json has start", typeof serverPkg.scripts?.start === "string");

// 7. Server Host & Port Binding Configuration
console.log("\nSection 7: Server Host & Port Binding");
const serverIndexContent = fs.readFileSync(path.resolve(process.cwd(), "packages/server/src/index.ts"), "utf-8");
check("Server index.ts reads PORT from process.env.PORT", serverIndexContent.includes("process.env.PORT"));
check("Server index.ts binds host defaulting to 0.0.0.0", serverIndexContent.includes('"0.0.0.0"') || serverIndexContent.includes("'0.0.0.0'"));
check("Server index.ts passes host to httpServer.listen", serverIndexContent.includes("httpServer.listen(port, host"));


console.log(`\n==================================================`);
console.log(`Staging Deployment Readiness Check: ${passes} PASS, ${failures} FAIL`);
console.log(`==================================================\n`);

if (failures > 0) {
  process.exit(1);
}
