// Apply a SQL migration via the Supabase Management API.
// We POST the SQL to https://api.supabase.com/v1/projects/{ref}/database/query
// using the Supabase CLI's access token (stored in macOS keychain). This
// avoids needing the DB password or any direct Postgres connection.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const envText = fs.readFileSync(".env.local", "utf8");
const urlMatch = envText.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m);
if (!urlMatch) throw new Error("NEXT_PUBLIC_SUPABASE_URL not in .env.local");
const raw = urlMatch[1].trim().replace(/^['"]|['"]$/g, "");
const hostname = new URL(raw).hostname;
const projectRef = hostname.replace(/\.supabase\.co$/, "");

const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error("usage: node scripts/apply-migration.mjs <sql-file>");
  process.exit(1);
}
const sql = fs.readFileSync(migrationPath, "utf8");
console.log(`Applying ${path.basename(migrationPath)} (${sql.length} bytes) to project ${projectRef}`);

// Pull the PAT out of the keychain (the Supabase CLI stores it as a
// base64-encoded blob with a "go-keyring-base64:" prefix).
const rawToken = execSync(
  'security find-generic-password -s "Supabase CLI" -a "supabase" -w',
  { encoding: "utf8" }
).trim();
const b64 = rawToken.replace(/^go-keyring-base64:/, "");
const token = Buffer.from(b64, "base64").toString("utf8").trim();
if (!token.startsWith("sbp_")) {
  throw new Error("Unexpected token format from keychain");
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const body = await res.text();
if (!res.ok) {
  console.error(`Management API returned ${res.status}`);
  console.error(body);
  process.exit(1);
}

console.log("Migration applied successfully.");
try {
  const parsed = JSON.parse(body);
  if (Array.isArray(parsed) && parsed.length) {
    console.log("Result:", JSON.stringify(parsed, null, 2));
  }
} catch {
  // body may be empty object
}
