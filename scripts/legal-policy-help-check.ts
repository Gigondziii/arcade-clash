// Guard with centralized disposable database check before anything else
import "./require-disposable-test-database.ts";

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../packages/server/src/db/client";
import { policyAcceptances, users } from "../packages/server/src/db/schema";
import { CURRENT_POLICY_VERSIONS, POLICY_NAV_ITEMS, type PolicyType } from "../packages/shared/src/policies";

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

async function runLegalPolicyHelpSuite(): Promise<void> {
  console.log("\n=======================================================");
  console.log("Fugluck Legal, Policies & Help Center Verification");
  console.log("=======================================================\n");

  // -------------------------------------------------------------------------
  // 1. Shared Policy Versioning & Navigation Manifest
  // -------------------------------------------------------------------------
  console.log("Section 1: Shared Policy Constants & Nav Manifest");

  const expectedPolicyTypes: PolicyType[] = [
    "TERMS",
    "PRIVACY",
    "COOKIES",
    "RULES",
    "DIAMONDS",
    "WITHDRAWALS",
    "REFUNDS",
    "RESPONSIBLE_PLAY",
    "ELIGIBILITY",
    "FAIR_PLAY",
    "DISPUTES",
    "DATA_RIGHTS",
    "SECURITY",
    "ABOUT",
    "CONTACT",
  ];

  check("All 15 policy types exist in CURRENT_POLICY_VERSIONS", expectedPolicyTypes.every((p) => typeof CURRENT_POLICY_VERSIONS[p] === "string" && CURRENT_POLICY_VERSIONS[p].length > 0));
  check("Terms version is canonical (2026-08-18)", CURRENT_POLICY_VERSIONS.TERMS === "2026-08-18");
  check("Privacy version is canonical (2026-08-18)", CURRENT_POLICY_VERSIONS.PRIVACY === "2026-08-18");

  check("POLICY_NAV_ITEMS has 16 items (15 policies + Help Center)", POLICY_NAV_ITEMS.length === 16);
  const categories = new Set(POLICY_NAV_ITEMS.map((item) => item.category));
  check("POLICY_NAV_ITEMS contains FUGLUCK category", categories.has("FUGLUCK"));
  check("POLICY_NAV_ITEMS contains LEGAL category", categories.has("LEGAL"));
  check("POLICY_NAV_ITEMS contains PLAY_AND_MONEY category", categories.has("PLAY_AND_MONEY"));
  check("POLICY_NAV_ITEMS contains ACCOUNT_AND_SAFETY category", categories.has("ACCOUNT_AND_SAFETY"));

  // -------------------------------------------------------------------------
  // 2. Client Legal Policy Data Completeness
  // -------------------------------------------------------------------------
  console.log("\nSection 2: Client Legal Policy Texts & Sections");

  const policyDataPath = path.resolve(process.cwd(), "packages/client/src/legal/policyData.ts");
  check("packages/client/src/legal/policyData.ts exists", fs.existsSync(policyDataPath));

  const policyContent = fs.readFileSync(policyDataPath, "utf-8");
  for (const pType of expectedPolicyTypes) {
    const slug = pType.toLowerCase().replace(/_/g, "-");
    check(`Policy data defines document for '${slug}'`, policyContent.includes(`slug: '${slug}'`));
  }

  // -------------------------------------------------------------------------
  // 3. Client Help Center FAQ Manifest
  // -------------------------------------------------------------------------
  console.log("\nSection 3: Help Center Categories & FAQ Items");

  const faqDataPath = path.resolve(process.cwd(), "packages/client/src/legal/faqData.ts");
  check("packages/client/src/legal/faqData.ts exists", fs.existsSync(faqDataPath));

  const faqContent = fs.readFileSync(faqDataPath, "utf-8");
  const expectedFaqCategories = [
    "getting-started",
    "playing-matches",
    "diamonds-and-wallet",
    "fairness-and-security",
    "account-and-login",
    "friends-and-social",
    "privacy-and-data",
    "support-and-help",
  ];

  for (const cat of expectedFaqCategories) {
    check(`FAQ data defines category '${cat}'`, faqContent.includes(`id: '${cat}'`));
  }

  // -------------------------------------------------------------------------
  // 4. Database Policy Acceptances & Consent Records
  // -------------------------------------------------------------------------
  console.log("\nSection 4: Database Policy Acceptances Mechanics");

  const runId = Date.now();
  const testUserId = `usr_policy_test_${runId}`;

  await db.insert(users).values({
    id: testUserId,
    username: `policy_user_${runId}`,
    email: `policy_${runId}@example.com`,
    passwordHash: "dummyhash",
    isEmailVerified: false,
    status: "active",
  });

  // Record consent for Terms and Privacy
  const termsAcceptanceId = `pa_terms_${runId}`;
  const privacyAcceptanceId = `pa_priv_${runId}`;

  await db.insert(policyAcceptances).values([
    {
      id: termsAcceptanceId,
      userId: testUserId,
      policyType: "TERMS",
      policyVersion: CURRENT_POLICY_VERSIONS.TERMS,
      source: "registration",
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0 Test Runner",
    },
    {
      id: privacyAcceptanceId,
      userId: testUserId,
      policyType: "PRIVACY",
      policyVersion: CURRENT_POLICY_VERSIONS.PRIVACY,
      source: "registration",
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0 Test Runner",
    },
  ]);

  const persistedAcceptances = await db.query.policyAcceptances.findMany({
    where: eq(policyAcceptances.userId, testUserId),
  });

  check("User has exactly 2 recorded policy acceptances", persistedAcceptances.length === 2);
  const termsRecord = persistedAcceptances.find((a) => a.policyType === "TERMS");
  check("Terms acceptance record has correct version", termsRecord?.policyVersion === CURRENT_POLICY_VERSIONS.TERMS);
  check("Terms acceptance record has registration source", termsRecord?.source === "registration");
  check("Terms acceptance record captures IP address", termsRecord?.ipAddress === "127.0.0.1");

  const privacyRecord = persistedAcceptances.find((a) => a.policyType === "PRIVACY");
  check("Privacy acceptance record has correct version", privacyRecord?.policyVersion === CURRENT_POLICY_VERSIONS.PRIVACY);

  // Subsequent policy acceptance (e.g. user action accepting DIAMOND terms)
  const diamondAcceptanceId = `pa_dia_${runId}`;
  await db.insert(policyAcceptances).values({
    id: diamondAcceptanceId,
    userId: testUserId,
    policyType: "DIAMONDS",
    policyVersion: CURRENT_POLICY_VERSIONS.DIAMONDS,
    source: "user_action",
    ipAddress: "192.168.1.100",
    userAgent: "Custom Client 1.0",
  });

  const updatedAcceptances = await db.query.policyAcceptances.findMany({
    where: eq(policyAcceptances.userId, testUserId),
  });
  check("User has 3 recorded policy acceptances after diamond terms acceptance", updatedAcceptances.length === 3);

  // Foreign key cascade delete test: deleting user cascades and deletes policy acceptances
  await db.delete(users).where(eq(users.id, testUserId));
  const acceptancesAfterUserDelete = await db.query.policyAcceptances.findMany({
    where: eq(policyAcceptances.userId, testUserId),
  });
  check("Cascading delete removes policy acceptances when user is deleted", acceptancesAfterUserDelete.length === 0);

  // -------------------------------------------------------------------------
  // 5. Localization Parity (en.json, ka.json, ru.json)
  // -------------------------------------------------------------------------
  console.log("\nSection 5: Policy Localization Key Parity");

  const enJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "packages/client/src/locales/en.json"), "utf-8"));
  const kaJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "packages/client/src/locales/ka.json"), "utf-8"));
  const ruJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "packages/client/src/locales/ru.json"), "utf-8"));

  check("en.json contains policies.nav keys", typeof enJson.policies?.nav === "object");
  check("ka.json contains policies.nav keys", typeof kaJson.policies?.nav === "object");
  check("ru.json contains policies.nav keys", typeof ruJson.policies?.nav === "object");

  const enKeys = Object.keys(enJson.policies?.nav || {});
  const kaKeys = Object.keys(kaJson.policies?.nav || {});
  const ruKeys = Object.keys(ruJson.policies?.nav || {});

  check("ka.json policies.nav has identical key count to en.json", enKeys.length === kaKeys.length);
  check("ru.json policies.nav has identical key count to en.json", enKeys.length === ruKeys.length);
  check("All en.json nav keys exist in ka.json", enKeys.every((k) => k in kaJson.policies.nav));
  check("All en.json nav keys exist in ru.json", enKeys.every((k) => k in ruJson.policies.nav));

  // -------------------------------------------------------------------------
  // 6. Legal Review Register
  // -------------------------------------------------------------------------
  console.log("\nSection 6: Legal Review Register");

  const registerPath = path.resolve(process.cwd(), "LEGAL_REVIEW_REQUIRED.md");
  check("LEGAL_REVIEW_REQUIRED.md exists at root", fs.existsSync(registerPath));
  const registerText = fs.readFileSync(registerPath, "utf-8");
  check("LEGAL_REVIEW_REQUIRED.md documents Skill-Gaming Classification", registerText.includes("Skill-Gaming Classification"));
  check("LEGAL_REVIEW_REQUIRED.md documents Minimum Age", registerText.includes("Minimum Age"));
  check("LEGAL_REVIEW_REQUIRED.md documents Geographical Restrictions", registerText.includes("Geographical Restrictions"));
  check("LEGAL_REVIEW_REQUIRED.md documents KYC / AML Thresholds", registerText.includes("KYC / AML Thresholds"));
  check("LEGAL_REVIEW_REQUIRED.md documents Withdrawal Limits", registerText.includes("Withdrawal Limits"));
}

async function main(): Promise<void> {
  try {
    await runLegalPolicyHelpSuite();

    console.log(`\n==================================================`);
    console.log(`Legal Policy & Help Center Check: ${passes} PASS, ${failures} FAIL`);
    console.log(`==================================================\n`);

    if (failures > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Fatal error during legal policy check:", err);
    process.exit(1);
  }
}

main();
