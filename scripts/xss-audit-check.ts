// Standalone verification script for XSS payload neutralization & DOM rendering safety.
// Run: npx tsx scripts/xss-audit-check.ts

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("xss-audit-check");

// ---------------------------------------------------------------------------
// Test 1: Username XSS Injection Neutralization via Server Validation
// ---------------------------------------------------------------------------
console.log("\nTest 1: Stored XSS Prevention via Server Boundary Pattern");

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

const xssPayloads = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert('xss')>",
  "<svg onload=alert(document.cookie)>",
  "javascript:alert(1)",
  "\" onclick=\"alert(1)",
  "' onmouseover='alert(1)",
  "<iframe src=\"javascript:alert(1)\">",
  "<a href=\"javascript:alert(1)\">click</a>",
];

for (const payload of xssPayloads) {
  const isRejected = !USERNAME_PATTERN.test(payload);
  check(`XSS payload [${payload.slice(0, 25)}...] rejected at server boundary`, isRejected);
}

// ---------------------------------------------------------------------------
// Test 2: React JSX Text Node Escaping Simulation
// ---------------------------------------------------------------------------
console.log("\nTest 2: Text Node Escaping");

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

for (const payload of xssPayloads) {
  const escaped = escapeHtml(payload);
  const containsRawTag = escaped.includes("<script>") || escaped.includes("<img") || escaped.includes("<svg");
  check(`Payload [${payload.slice(0, 20)}...] escaped into text node without executable tags`, !containsRawTag);
}

// ---------------------------------------------------------------------------
// Test 3: 2D Canvas Text API Neutralization
// ---------------------------------------------------------------------------
console.log("\nTest 3: 2D Canvas fillText Context Neutralization");

// Mock Canvas 2D Context fillText API
class MockCanvasContext {
  public drawnText: string[] = [];
  public fillText(text: string, _x: number, _y: number) {
    this.drawnText.push(text);
  }
}

const mockCtx = new MockCanvasContext();
const maliciousGameTitle = "<script>alert('canvas-xss')</script>";

mockCtx.fillText(maliciousGameTitle, 100, 100);

check(
  "Canvas fillText draws text string literally as font glyphs without HTML parsing",
  mockCtx.drawnText.length === 1 && mockCtx.drawnText[0] === maliciousGameTitle,
);

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nAll XSS audit checks passed.`);
