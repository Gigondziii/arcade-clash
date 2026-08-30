// Centralized legal, policy, and compliance version identifiers and metadata.
// Code is the source of truth. Version bumps here mandate re-consent where configured.

export type PolicyType =
  | "TERMS"
  | "PRIVACY"
  | "COOKIES"
  | "RULES"
  | "DIAMONDS"
  | "WITHDRAWALS"
  | "REFUNDS"
  | "RESPONSIBLE_PLAY"
  | "ELIGIBILITY"
  | "FAIR_PLAY"
  | "DISPUTES"
  | "DATA_RIGHTS"
  | "SECURITY"
  | "ABOUT"
  | "CONTACT";

export const CURRENT_POLICY_VERSIONS: Record<PolicyType, string> = {
  TERMS: "2026-08-18",
  PRIVACY: "2026-08-18",
  COOKIES: "2026-08-18",
  RULES: "2026-08-18",
  DIAMONDS: "2026-08-18",
  WITHDRAWALS: "2026-08-18",
  REFUNDS: "2026-08-18",
  RESPONSIBLE_PLAY: "2026-08-18",
  ELIGIBILITY: "2026-08-18",
  FAIR_PLAY: "2026-08-18",
  DISPUTES: "2026-08-18",
  DATA_RIGHTS: "2026-08-18",
  SECURITY: "2026-08-18",
  ABOUT: "2026-08-18",
  CONTACT: "2026-08-18",
};

export type PolicyAcceptanceRecord = {
  id: string;
  userId: string;
  policyType: PolicyType;
  policyVersion: string;
  acceptedAt: string;
  source: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type SignupAcceptedPolicies = {
  termsVersion: string;
  privacyVersion: string;
};

export type PolicyNavItem = {
  id: PolicyType | "HELP";
  titleKey: string;
  path: string;
  category: "FUGLUCK" | "LEGAL" | "PLAY_AND_MONEY" | "ACCOUNT_AND_SAFETY";
};

export const POLICY_NAV_ITEMS: PolicyNavItem[] = [
  // FUGLUCK
  { id: "ABOUT", titleKey: "policies.nav.about", path: "/about", category: "FUGLUCK" },
  { id: "HELP", titleKey: "policies.nav.help", path: "/help", category: "FUGLUCK" },
  { id: "CONTACT", titleKey: "policies.nav.contact", path: "/contact", category: "FUGLUCK" },

  // LEGAL
  { id: "TERMS", titleKey: "policies.nav.terms", path: "/terms", category: "LEGAL" },
  { id: "PRIVACY", titleKey: "policies.nav.privacy", path: "/privacy", category: "LEGAL" },
  { id: "COOKIES", titleKey: "policies.nav.cookies", path: "/cookies", category: "LEGAL" },

  // PLAY & MONEY
  { id: "RULES", titleKey: "policies.nav.rules", path: "/rules", category: "PLAY_AND_MONEY" },
  { id: "DIAMONDS", titleKey: "policies.nav.diamonds", path: "/diamonds", category: "PLAY_AND_MONEY" },
  { id: "WITHDRAWALS", titleKey: "policies.nav.withdrawals", path: "/withdrawals", category: "PLAY_AND_MONEY" },
  { id: "REFUNDS", titleKey: "policies.nav.refunds", path: "/refunds", category: "PLAY_AND_MONEY" },
  { id: "RESPONSIBLE_PLAY", titleKey: "policies.nav.responsiblePlay", path: "/responsible-play", category: "PLAY_AND_MONEY" },
  { id: "FAIR_PLAY", titleKey: "policies.nav.fairPlay", path: "/fair-play", category: "PLAY_AND_MONEY" },

  // ACCOUNT & SAFETY
  { id: "ELIGIBILITY", titleKey: "policies.nav.eligibility", path: "/eligibility", category: "ACCOUNT_AND_SAFETY" },
  { id: "DISPUTES", titleKey: "policies.nav.disputes", path: "/disputes", category: "ACCOUNT_AND_SAFETY" },
  { id: "DATA_RIGHTS", titleKey: "policies.nav.dataRights", path: "/data-rights", category: "ACCOUNT_AND_SAFETY" },
  { id: "SECURITY", titleKey: "policies.nav.security", path: "/security", category: "ACCOUNT_AND_SAFETY" },
];
