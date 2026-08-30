# Fugluck — Legal, Regulatory & Policy Review Register

> **Status:** ACTIVE REGISTER  
> **Last Updated:** 2026-08-18  
> **Purpose:** Centralized internal tracking of open regulatory, licensing, financial, and jurisdictional determinations. No definitive factual or statutory claims regarding these items are to be hardcoded into user-facing copy without formal legal confirmation.

---

## 1. Regulatory & Licensing Determinations

| Item | Current System Status | Open Legal / Compliance Determination | Action Needed Before Real-Money Launch |
| :--- | :--- | :--- | :--- |
| **Skill-Gaming Classification** | Server-authoritative deterministic 60 FPS physics loop, synchronized seed, headless score anti-cheat validation. | Formal jurisdictional classification of Fugluck mini-games under skill-based gaming vs prize gaming vs gambling statutes in primary target markets (e.g. EU, US states, Georgia, UK). | Obtain legal opinion letters per operating territory confirming skill-game status. |
| **Platform Licensing** | Platform code makes zero claims of specific gaming or lottery licenses. | Determine whether operating as a skill gaming operator requires a specific contest/skill-gaming license, corporate registration, or notification in target jurisdictions. | Consult gaming regulatory counsel. |
| **Tax Treatment of Winnings** | Platform tracks gross winnings, entry wagers, and rake in immutable PostgreSQL ledger. | Tax reporting obligations (e.g. 1099-MISC in US, DAC7 in EU, local withholding rules) on player Diamond net winnings. | Retain tax advisor for gaming platform reporting rules. |

---

## 2. Eligibility & Age Restrictions

| Item | Current System Status | Open Legal / Compliance Determination | Action Needed Before Real-Money Launch |
| :--- | :--- | :--- | :--- |
| **Minimum Age** | Policy text specifies "legal age to form a binding contract and participate in skill-based competitions in your jurisdiction." | Determine hard minimum age threshold (e.g. 18+ vs 21+ vs 19+ in specific states/countries) for free COINS vs real-money DIAMONDS. | Update registration gate and age verification rules once counsel confirms. |
| **Geographical Restrictions** | Policy mentions general compliance with applicable local laws and reservation of rights to block restricted/sanctioned territories. | Finalize explicit list of permitted vs restricted countries/states (e.g. US states prohibiting real-money skill gaming like AZ, IA, LA, SC, MT; international sanctioned list). | Configure geo-IP blocking middleware and terms country list. |

---

## 3. Financial, KYC & Payment Rules

| Item | Current System Status | Open Legal / Compliance Determination | Action Needed Before Real-Money Launch |
| :--- | :--- | :--- | :--- |
| **Diamond / Currency Conversion Rate** | Sandbox stub packs configure 100, 250, 500, 1000, 2500 Diamonds. | Canonical fixed exchange rate between Diamonds and fiat currencies (USD, EUR, GEL). | Set production pricing matrix upon payment processor onboarding. |
| **KYC / AML Thresholds** | `policy_acceptances` table records user consent timestamps, IPs, and policy versions. | Specific cumulative withdrawal or deposit amount triggering mandatory identity verification (e.g. €2,000 / $2,000 threshold under AML directives). | Integrate KYC verification provider (e.g. Sumsub, Persona, Veriff). |
| **Withdrawal Limits & Timelines** | `withdrawals` policy describes multi-step reservation lifecycle and AML review without fabricated numeric limits. | Minimum withdrawal amount, maximum daily/monthly cash-out limit, processing SLA (e.g. 24-48 business hours), and payout fee structure. | Configure withdrawal thresholds in server environment config. |
| **Playthrough Requirements** | Policy distinguishes unwagered deposit refunds from won Diamond cash-outs. | Exact wagering multiple required on purchased Diamonds before cash-out eligibility to satisfy anti-money laundering regulations. | Code automated playthrough accumulator rule into withdrawal validation. |
| **Payment Processors** | Direct Diamond purchase architecture designed in `real_money_diamond_economy_architecture.md`. | Selection and contract execution with merchant acquiring and payout partners (e.g. Stripe, PayPal, card acquirers). | Implement provider-specific adapter adhering to `PaymentProvider` interface. |

---

## 4. Policy Versioning & Acceptance Tracking

- **Current Mandatory Policy Versions:**
  - `TERMS`: `2026-08-18`
  - `PRIVACY`: `2026-08-18`
  - `COOKIES`: `2026-08-18`
  - `RULES`: `2026-08-18`
  - `DIAMONDS`: `2026-08-18`
  - `WITHDRAWALS`: `2026-08-18`
  - `REFUNDS`: `2026-08-18`
  - `RESPONSIBLE_PLAY`: `2026-08-18`
  - `ELIGIBILITY`: `2026-08-18`
  - `FAIR_PLAY`: `2026-08-18`
  - `DISPUTES`: `2026-08-18`
  - `DATA_RIGHTS`: `2026-08-18`
  - `SECURITY`: `2026-08-18`
  - `ABOUT`: `2026-08-18`
  - `CONTACT`: `2026-08-18`
- **Durable Database Audit:** All registrations record IP, User-Agent, Policy Type, and Version in `policy_acceptances`.
